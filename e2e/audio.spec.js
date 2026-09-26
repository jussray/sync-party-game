import { test, expect } from '@playwright/test';

test('opt-in mixer produces signal, mutes immediately and persists only levels on phone', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await expect(page.getByRole('button',{name:'Toggle party sound'})).toHaveAttribute('aria-pressed','false');
  await page.getByRole('button',{name:'Open sound controls'}).click();
  await expect(page.locator('#audioOutput')).toHaveAttribute('value','0');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'TURN SOUND ON',exact:true}).click();
  await expect(page.locator('#audioState')).toHaveText('Sound is on. Adjust your mix below.');
  await expect.poll(async()=>Number(await page.locator('#audioOutput').getAttribute('value'))).toBeGreaterThan(.001);
  await page.getByRole('slider',{name:'Background beat'}).press('Home');
  await page.getByRole('button',{name:'🏆 Victory'}).click();
  await expect(page.locator('#lastSound')).toHaveText('Last cue: win');
  await expect.poll(async()=>Number(await page.locator('#audioOutput').getAttribute('value'))).toBeGreaterThan(.01);
  await page.getByRole('button',{name:'MUTE ALL SOUND'}).click();
  await expect.poll(async()=>Number(await page.locator('#audioOutput').getAttribute('value'))).toBe(0);
  await page.reload();
  await expect(page.getByRole('button',{name:'Toggle party sound'})).toHaveAttribute('aria-pressed','false');
  await page.getByRole('button',{name:'Open sound controls'}).click();
  await expect(page.getByRole('slider',{name:'Background beat'})).toHaveValue('0');
});

test('audio asset failure leaves the game usable and can be retried',async({page})=>{
  await page.route('**/audio/*.wav',route=>route.fulfill({status:503,body:''}));
  await page.goto('/');
  await page.getByRole('button',{name:'Open sound controls'}).click();
  await page.getByRole('button',{name:'TURN SOUND ON',exact:true}).click();
  await expect(page.locator('#audioState')).toContainText('could not load');
  await expect(page.getByRole('button',{name:'Toggle party sound'})).toHaveAttribute('aria-pressed','false');
  await page.unroute('**/audio/*.wav');
  await page.getByRole('button',{name:'TURN SOUND ON',exact:true}).click();
  await expect(page.locator('#audioState')).toHaveText('Sound is on. Adjust your mix below.');
  await page.getByRole('button',{name:'Close sound controls'}).click();
  await expect(page.getByRole('button',{name:'Create a game →'})).toBeEnabled();
});
