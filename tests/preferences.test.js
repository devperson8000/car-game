import {test} from 'node:test';import assert from 'node:assert/strict';
import {loadPreferences,savePreference,readBestLap,saveBestLap} from '../src/preferences.js';
import {formatTime} from '../src/hud.js';
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v))};};
test('lap clock rounds across minute boundaries without displaying sixty seconds',()=>{
 assert.equal(formatTime(59.9996),'01:00.000');assert.equal(formatTime(125.1234),'02:05.123');assert.equal(formatTime(null),'— — : — —');assert.equal(formatTime(NaN),'— — : — —');
});
test('preferences restore valid values and discard corrupt choices',()=>{
 const s=storage();s.setItem('apex-route','unknown');s.setItem('apex-quality','ultra');s.setItem('apex-paint','bad');
 savePreference(s,'muted',true);savePreference(s,'touch',false);savePreference(s,'camera',2);
 const p=loadPreferences(s);assert.equal(p.route,'mountain');assert.equal(p.quality,'balanced');assert.equal(p.paint,'#b8172e');assert.equal(p.muted,true);assert.equal(p.touch,false);assert.equal(p.camera,2);
});
test('personal bests survive reload and remain separate for each circuit',()=>{
 const s=storage();saveBestLap(s,'mountain',300);saveBestLap(s,'mountain',320);saveBestLap(s,'nordschleife',510);
 assert.equal(readBestLap(s,'mountain'),300);assert.equal(readBestLap(s,'nordschleife'),510);
 assert.equal(saveBestLap(s,'mountain',290),290);assert.equal(saveBestLap(s,'mountain',NaN),290);
});
test('blocked browser storage does not break settings or lap completion',()=>{
 const s={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
 assert.equal(loadPreferences(s).quality,'balanced');assert.equal(saveBestLap(s,'mountain',300),300);assert.equal(readBestLap(s,'mountain'),null);
});

test('manual transmission preference survives reload and rejects invalid values',()=>{
 const s=storage();assert.equal(loadPreferences(s).transmission,'auto');savePreference(s,'transmission','manual');assert.equal(loadPreferences(s).transmission,'manual');savePreference(s,'transmission','broken');assert.equal(loadPreferences(s).transmission,'auto');
});

test('each car keeps separate personal bests on the same route',()=>{const s=storage();saveBestLap(s,'mountain',300,'apex');saveBestLap(s,'mountain',350,'brz');assert.equal(readBestLap(s,'mountain','brz'),350);assert.equal(readBestLap(s,'mountain','m3'),null);assert.equal(readBestLap(s,'mountain'),300);});

test('garage cars have independent paint choices',()=>{const s=storage();savePreference(s,'car','brz');assert.equal(loadPreferences(s).paint,'#3f74d5');savePreference(s,'paint-brz','#abcdef');savePreference(s,'car','m3');assert.equal(loadPreferences(s).paint,'#e4e6e9');savePreference(s,'car','brz');assert.equal(loadPreferences(s).paint,'#abcdef');});
