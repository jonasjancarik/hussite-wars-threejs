// Run with Playwright available through NODE_PATH; uses a disposable browser.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');

(async () => {
  const browser = await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const context = await browser.newContext({viewport:{width:412,height:850},hasTouch:true,isMobile:true,deviceScaleFactor:1});
    const page = await context.newPage();
    const errors=[];
    const playable=process.env.BATTLE_PLAYABLE === '1';
    const pauseName=playable?'Pause battle':'Pause atmosphere';
    const resumeName=playable?'Resume battle':'Resume atmosphere';
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(process.env.DIORAMA_URL || 'http://127.0.0.1:8082/diorama.html');
    await page.locator('#loading').waitFor({state:'detached',timeout:60000});
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.getByRole('button',{name:pauseName,exact:true}).tap();
    await page.getByRole('button',{name:resumeName,exact:true}).waitFor();
    await page.waitForTimeout(500);
    const capture=async()=>createHash('sha256').update(await page.screenshot({clip:{x:0,y:180,width:412,height:490}})).digest('hex');
    const before=await capture();
    await page.waitForTimeout(500);
    assert.equal(await capture(),before,'Pause button must actually freeze the rendered atmosphere');
    const cdp=await context.newCDPSession(page);
    const send=async(type,points)=>{await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});await page.waitForTimeout(120);};
    const point=(id,x,y)=>({id,x,y});
    await send('touchStart',[point(1,180,430)]);
    await send('touchMove',[point(1,255,455)]);
    await send('touchEnd',[]);
    const orbit=await capture();assert.notEqual(orbit,before,'One finger must rotate the scene');
    await send('touchStart',[point(1,160,410),point(2,250,410)]);
    await send('touchMove',[point(1,110,410),point(2,300,410)]);
    await send('touchEnd',[]);
    const zoom=await capture();assert.notEqual(zoom,orbit,'Pinch must zoom the scene');
    await send('touchStart',[point(1,130,430),point(2,280,430)]);
    await send('touchMove',[point(1,155,455),point(2,305,455)]);
    await send('touchEnd',[]);
    const pan=await capture();assert.notEqual(pan,zoom,'Two fingers must pan the scene');
    await send('touchStart',[point(1,190,435)]);
    await send('touchCancel',[]);
    assert.equal(await capture(),pan,'Cancel must not move the scene');
    await page.getByRole('button',{name:'Frame scene',exact:true}).tap();
    await page.waitForTimeout(500);
    assert.equal(await capture(),before,'Frame button must restore the initial camera');
    if (playable) {
      await send('touchStart',[point(1,220,415)]);
      await send('touchEnd',[]);
      assert.notEqual(await capture(),before,'A ground tap must display a formation order');
    }
    assert.equal(await page.evaluate(()=>window.visualViewport.scale),1,'Gestures must not zoom the browser page');
    await page.getByRole('button',{name:'Landscape plan',exact:true}).tap();
    await page.getByRole('dialog').waitFor({state:'visible'});
    await page.getByRole('button',{name:'Close',exact:true}).tap();
    await page.getByRole('button',{name:resumeName,exact:true}).tap();
    await page.getByRole('button',{name:pauseName,exact:true}).waitFor();
    if (playable) {
      const moving=await capture();await page.waitForTimeout(1500);
      assert.notEqual(await capture(),moving,'The resumed battle must advance');
      await page.getByRole('button',{name:'Reset battle',exact:true}).tap();
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: phone layout, actual pause/resume, orbit, pinch, pan, cancel, frame restore, plan dialog; browser zoom unchanged; no page errors.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
