// Fictional 4.0L naturally aspirated V8. These are game tuning values,
// not specifications or calibrated dynamics of a real production vehicle.
export const SPEC = {
  name: 'APEX GT', mass: 1435, inertia: [2300, 2600, 620], comH: .40, drive: 'RWD',
  wheels: {
    // Rear track leaves tire sidewalls inside the measured GLB fenders.
    fz: -1.50, rz: .96, htF: .82, htR: .84,
    attachY: .21, restLen: .28, radius: .34, iw: 1.4,
    kF: 62000, kR: 88000, cBF: 4100, cRF: 6700, cBR: 6200, cRR: 9900,
    maxC: .16, muF: 1.08, muR: 1.12,
  },
  arbF: 32000, arbR: 20000,
  engine: {
    rpm: [900,1500,2500,3500,4500,5500,6300,7000,8000,8500,9000],
    nm:  [180,240,305,345,385,430,465,460,440,385,90],
    idle: 900, redline: 8500, engBrake: [25,.014], shiftDown: 3000,
  },
  gears: [3.75,2.38,1.72,1.34,1.11,.96,.84], final: 4.19, reverse: 3.5,
  brakeT: 6400, bias: .61, aero: {cda:.79,cla:.95},
  engine_model: {
    cyl:8, intakeLen:85, exhaustLen:65, extractorLen:60, straightPipeLen:80,
    mufflerElements:[5,8,11,14], mufflerAction:.12, ignitionTime:.008,
    intakeOpen:.22, intakeClosed:.9, exhaustOpen:.22, exhaustClosed:.95,
    outletGain:1.1, intakeMix:.8, blockMix:.6, decelPops:.3, level:.65,
    hpHz:100,hpQ:.7,cutF:150,cutQ:1.1,cutDb:-6,peakF:950,peakQ:.7,peakDb:3,shelfF:4200,shelfDb:1.5,
  },
};
