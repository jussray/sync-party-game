"""Original SYNC audio assets. Standard-library deterministic synthesis; no samples."""
import math, random, wave, struct, json
from pathlib import Path
SR=24000
out=Path(__file__).resolve().parents[1]/'public'/'audio'
random.seed(42)
def new(seconds): return [0.0]*int(SR*seconds)
def freq(midi): return 440*2**((midi-69)/12)
def note(buf,start,dur,midi,vol=.1,bright=.2):
    start=int(start*SR); length=int(dur*SR); f=freq(midi)
    for j in range(min(length,len(buf)-start)):
        t=j/SR; attack=min(1,t/.006); env=attack*math.exp(-t*5/max(.2,dur))*min(1,(length-j)/(.025*SR))
        buf[start+j]+=vol*env*(math.sin(2*math.pi*f*t)+bright*math.sin(2*math.pi*2*f*t)+.07*math.sin(2*math.pi*3*f*t))
def kick(buf,start,vol=.13):
    start=int(start*SR)
    for j in range(min(int(SR*.23),len(buf)-start)):
        t=j/SR;buf[start+j]+=vol*(1-math.exp(-t*900))*math.exp(-t*22)*math.sin(2*math.pi*(48*t+4*(1-math.exp(-t*30))))
def noise(buf,start,dur,vol,decay):
    start=int(start*SR);last=0
    for j in range(min(int(SR*dur),len(buf)-start)):
        t=j/SR;n=random.uniform(-1,1); high=n-last;last=n
        buf[start+j]+=vol*high*min(1,t/.002)*math.exp(-t*decay)
assets={}
def save(name,buf):
    peak=max(map(abs,buf)); scale=.72/max(.001,peak)
    samples=[max(-32767,min(32767,round(v*scale*32767))) for v in buf]
    with wave.open(str(out/(name+'.wav')),'wb') as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes(struct.pack('<'+'h'*len(samples),*samples))
    rms=(sum((v/32767)**2 for v in samples)/len(samples))**.5
    assert 0<rms<.3 and max(map(abs,samples))<32767
    assets[name]={'seconds':round(len(samples)/SR,3),'peak':round(peak*scale,5),'rms':round(rms,5),'sampleRate':SR,'clippedSamples':0}
beat=60/108;music=new(32*beat)
chords=[(45,[69,72,76,79]),(41,[65,69,72,76]),(48,[67,72,76,79]),(43,[67,71,74,79])]
for b in range(32):
    root,chord=chords[(b//8)%4]
    kick(music,b*beat,.11 if b%4==0 else .085)
    if b%4 in [1,3]:noise(music,b*beat,.13,.018,28)
    for half in [0,.5]:noise(music,(b+half)*beat,.055,.009,85)
    note(music,b*beat,.36,root,.115,.13)
    if b%2==1:note(music,(b+.5)*beat,.24,root+12,.045,.1)
    for half in [0,.5]:note(music,(b+half)*beat,.37,chord[(b*2+int(half*2))%4],.029,.25)
# A short edge ramp avoids clicks when the original loop repeats.
for i in range(240):music[i]*=i/240;music[-1-i]*=i/240
save('party-loop',music)
for name,mids,times,length in [('tap',[76,81],[0,.055],.24),('lock',[69,76,81],[0,.075,.15],.5),('round',[60,64,67,72],[0,.08,.16,.24],.8),('reveal',[60,64,67,72,76],[0,.085,.17,.255,.34],1.1),('win',[60,64,67,72,76,79,84],[0,.13,.26,.39,.52,.65,.85],2.0)]:
    a=new(length)
    for m,t in zip(mids,times):note(a,t,.7 if name=='win' else .4,m,.11,.28)
    if name=='reveal':kick(a,.27,.12)
    save(name,a)
for left in range(1,6):
    a=new(.38);note(a,0,.13,83+(5-left)*2,.11,.2)
    if left<=3:note(a,.15,.11,83+(5-left)*2,.075,.2)
    save('tick-'+str(left),a)
for count,midi in [(3,69),(2,73),(1,76)]:
    a=new(.35);note(a,0,.28,midi,.095,.15);save('count-'+str(count),a)
# Audition montage: same shipped assets and default mix levels.
montage=[v*.25 for v in music[:SR*12]]
for sec,key in [(1,'lock'),(3,'tick-5'),(4,'tick-4'),(5,'tick-3'),(6,'tick-2'),(7,'tick-1'),(8,'reveal'),(9.6,'win')]:
    with wave.open(str(out/(key+'.wav')),'rb') as w:raw=w.readframes(w.getnframes()); vals=struct.unpack('<'+'h'*(len(raw)//2),raw)
    for i,v in enumerate(vals):
        k=int(sec*SR)+i
        if k<len(montage):montage[k]+=v/32767*.7
save('sound-preview',montage)
(out/'manifest.json').write_text(json.dumps(assets,indent=2)+'\n')
print(json.dumps({'assets':len(assets),'music':assets['party-loop'],'preview':assets['sound-preview'],'allClippingChecksPassed':True}))
