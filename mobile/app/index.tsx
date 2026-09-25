import { useEffect, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  createRoom,
  joinRoom,
  openRoomSocket,
  sendRoomAction,
  type PublicRoomState,
  type RoomSession,
  type RoomSocketMessage,
} from '../src/protocol';

export default function SyncPartyMobile() {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [session, setSession] = useState<RoomSession | null>(null);
  const [room, setRoom] = useState<PublicRoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const lastPhaseRef = useRef<PublicRoomState['phase'] | null>(null);

  const me = useMemo(
    () => room?.players.find((player) => player.id === session?.playerId) ?? null,
    [room, session?.playerId],
  );

  useEffect(() => () => socketRef.current?.close(), []);

  async function attach(nextSession: RoomSession) {
    socketRef.current?.close();
    const socket = openRoomSocket(nextSession);
    socketRef.current = socket;
    setSession(nextSession);
    setRoomCode(nextSession.code);

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as RoomSocketMessage;
        if (message.type === 'STATE') {
          const previous = lastPhaseRef.current;
          lastPhaseRef.current = message.state.phase;
          setRoom(message.state);
          if (previous && previous !== message.state.phase && (message.state.phase === 'reveal' || message.state.phase === 'results')) {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        } else if (message.type === 'ERROR') {
          setError(message.error || message.message || 'The room rejected that action.');
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
      } catch {
        setError('The room sent an unreadable update.');
      }
    };
    socket.onerror = () => setError('The room connection hit a network error.');
    socket.onclose = () => setError((current) => current ?? 'Room connection closed. Rejoin to continue.');
  }

  async function create() {
    const cleanName = name.trim();
    if (!cleanName) return setError('Enter a nickname first.');
    setBusy(true);
    setError(null);
    try {
      await attach(await createRoom(cleanName));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create the room.');
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    const cleanName = name.trim();
    const code = roomCode.trim().toUpperCase();
    if (!cleanName || code.length !== 5) return setError('Enter a nickname and a 5-character room code.');
    setBusy(true);
    setError(null);
    try {
      await attach(await joinRoom(code, cleanName));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not join the room.');
    } finally {
      setBusy(false);
    }
  }

  function action(type: string, extra: Record<string, unknown> = {}) {
    try {
      setError(null);
      sendRoomAction(socketRef.current, { type, ...extra });
      void Haptics.selectionAsync();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not send that action.');
    }
  }

  async function shareInvite() {
    if (!session) return;
    await Haptics.selectionAsync();
    await Share.share({
      title: 'Join my Sync Party',
      message: `Join my Sync Party room with code ${session.code}.`,
    });
  }

  if (!session || !room) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.eyebrow}>NATIVE MULTIPLAYER ADAPTER</Text>
          <Text style={styles.title}>Same room. Same authority. More pocket-sized chaos.</Text>
          <Text style={styles.subtitle}>Create or join the existing Sync Party Durable Object room. The web game stays the no-install path.</Text>

          <View style={styles.card}>
            <Text style={styles.label}>Nickname</Text>
            <TextInput accessibilityLabel="Nickname" value={name} onChangeText={setName} maxLength={18} placeholder="your party name" placeholderTextColor="#6b7280" style={styles.input} />
            <Text style={styles.label}>Room code</Text>
            <TextInput accessibilityLabel="Room code" value={roomCode} onChangeText={setRoomCode} maxLength={5} autoCapitalize="characters" placeholder="ABCDE" placeholderTextColor="#6b7280" style={styles.input} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.buttonRow}>
              <Pressable disabled={busy} onPress={() => void create()} style={styles.primaryButton}><Text style={styles.primaryText}>Create room</Text></Pressable>
              <Pressable disabled={busy} onPress={() => void join()} style={styles.secondaryButton}><Text style={styles.secondaryText}>Join room</Text></Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const isHost = session.playerId === room.hostId;
  const myScore = room.scores[session.playerId] ?? 0;
  const hasAnswered = Object.prototype.hasOwnProperty.call(room.answers, session.playerId);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.roomHeader}>
          <View>
            <Text style={styles.eyebrow}>ROOM {room.code}</Text>
            <Text style={styles.titleSmall}>{room.phase.toUpperCase()}</Text>
          </View>
          <Pressable accessibilityLabel="Share room invite" onPress={() => void shareInvite()} style={styles.inviteButton}><Text style={styles.inviteText}>Share invite</Text></Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{me?.name ?? name} · {myScore} pts</Text>
          <Text style={styles.muted}>Players: {room.players.map((player) => `${player.connected ? '●' : '○'} ${player.name}`).join('  ')}</Text>
          <Text style={styles.muted}>State #{room.seq} · {room.stateHash ? room.stateHash.slice(0, 10) : 'hash pending'}</Text>
        </View>

        {room.phase === 'lobby' ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Waiting room</Text>
            <Text style={styles.muted}>Share the code. At least two connected players are required.</Text>
            {isHost ? <Pressable onPress={() => action('START_GAME')} style={styles.primaryButton}><Text style={styles.primaryText}>Start game</Text></Pressable> : null}
          </View>
        ) : null}

        {room.phase === 'choosing' && room.prompt ? (
          <View style={styles.card}>
            <Text style={styles.mode}>{room.mode?.label}</Text>
            <Text style={styles.prompt}>{room.prompt.text}</Text>
            <Text style={styles.muted}>{room.mode?.instruction}</Text>
            <View style={styles.choiceList}>
              {room.prompt.choices.map((choice, index) => (
                <Pressable key={choice} disabled={hasAnswered} onPress={() => action('SUBMIT_CHOICE', { choiceIndex: index })} style={[styles.choiceButton, hasAnswered && styles.disabled]}>
                  <Text style={styles.choiceText}>{choice}</Text>
                </Pressable>
              ))}
            </View>
            {hasAnswered ? <Text style={styles.locked}>Choice locked. Waiting for the reveal…</Text> : null}
          </View>
        ) : null}

        {room.phase === 'reveal' ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Reveal ✨</Text>
            <Text style={styles.syncPercent}>{room.lastResults?.syncPercent ?? 0}% sync</Text>
            <Text style={styles.muted}>Your score: {myScore}</Text>
            {isHost ? <Pressable onPress={() => action('NEXT_ROUND')} style={styles.primaryButton}><Text style={styles.primaryText}>Next round</Text></Pressable> : null}
          </View>
        ) : null}

        {room.phase === 'results' ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Final scores</Text>
            {room.players.slice().sort((a, b) => (room.scores[b.id] ?? 0) - (room.scores[a.id] ?? 0)).map((player) => (
              <Text key={player.id} style={styles.scoreLine}>{player.name}: {room.scores[player.id] ?? 0}</Text>
            ))}
            {isHost ? <Pressable onPress={() => action('REMATCH')} style={styles.primaryButton}><Text style={styles.primaryText}>Rematch</Text></Pressable> : null}
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#030712' },
  content: { padding: 20, paddingBottom: 48, gap: 16 },
  eyebrow: { color: '#22d3ee', fontSize: 12, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: '#f9fafb', fontSize: 30, lineHeight: 36, fontWeight: '900' },
  titleSmall: { color: '#f9fafb', fontSize: 22, fontWeight: '900' },
  subtitle: { color: '#9ca3af', fontSize: 15, lineHeight: 22 },
  card: { backgroundColor: '#111827', borderColor: '#1f2937', borderWidth: 1, borderRadius: 20, padding: 18, gap: 12 },
  label: { color: '#d1d5db', fontSize: 13, fontWeight: '800' },
  input: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: '#374151', backgroundColor: '#030712', color: '#f9fafb', paddingHorizontal: 14, fontSize: 16 },
  error: { color: '#fca5a5', fontSize: 13, lineHeight: 19 },
  buttonRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  primaryButton: { backgroundColor: '#0891b2', borderRadius: 14, paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center' },
  primaryText: { color: '#ecfeff', fontWeight: '900' },
  secondaryButton: { borderColor: '#22d3ee', borderWidth: 1, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center' },
  secondaryText: { color: '#a5f3fc', fontWeight: '900' },
  roomHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  inviteButton: { borderColor: '#374151', borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9 },
  inviteText: { color: '#d1d5db', fontSize: 12, fontWeight: '800' },
  sectionTitle: { color: '#f9fafb', fontSize: 18, fontWeight: '900' },
  muted: { color: '#9ca3af', fontSize: 12, lineHeight: 18 },
  mode: { color: '#67e8f9', fontSize: 13, fontWeight: '900' },
  prompt: { color: '#f9fafb', fontSize: 22, lineHeight: 28, fontWeight: '900' },
  choiceList: { gap: 8 },
  choiceButton: { backgroundColor: '#1f2937', borderColor: '#374151', borderWidth: 1, borderRadius: 14, padding: 14 },
  choiceText: { color: '#f9fafb', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  locked: { color: '#67e8f9', fontSize: 12, fontWeight: '800' },
  syncPercent: { color: '#22d3ee', fontSize: 42, fontWeight: '900' },
  scoreLine: { color: '#e5e7eb', fontSize: 15, fontWeight: '700' },
});
