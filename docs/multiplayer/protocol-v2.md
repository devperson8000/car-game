# Smooth multiplayer protocol v2 implementation contract

Shared module src/sim/network-state.js exports INPUT_DT=1/60, captureSession(session), restoreSession(session,data), applyInputFrame(session,frame). Capture contains complete solver/drivetrain/suspension/lap fields and preserves vector identities on restore.

Hello adds protocolVersion:2. New browser replies {type:'protocol',version:2}. Legacy connections remain protocol1. Owner approval/resume/room/lobby messages unchanged.

Version2 input envelope retains legacy fields type,input seq,controls,parked,auto and adds epoch (integer from own ack), frames:[{seq:fixedFrameSequence, controls,auto,tc,abs,shifts:['up'/'down']}]. Up to15 frames per envelope. Frame dt is FIXED1/60; clients cannot supply time. Frames contiguous starting0 in each epoch, envelope seq only increasing. Validate entire batch atomically before queuing; queued frames bounded120 max. Ignore old epochs without flooding errors. Never accept transforms/laps from client.

Each player has inputEpoch incremented on grid/recover/resume; lastReceivedFrame/lastProcessedFrame initial-1, pendingFrames, simulationBudget. On every server tick budget+=dt, cap0.12sec. In v2 running phase consume queued frames via applyInputFrame while budget>=INPUT_DT, deduct budget. This permits catching up bursty packets but never sustained sim faster than wallclock. Clear budget/queues on parked/stale safety transition; increment epoch ONCE per safety transition and explicitly synchronize client. No-frame packet alone does not mean stale (normal when paused); stale=lastInput older500ms. Safety braking should remain real-time server physics and acknowledged epoch prevents replay over it. Countdowns/lobby are stationary for framed protocol; start running changes epoch to restart fixed frame stream. Legacy input mode keeps existing behavior.

Snapshots to v2 peers contain:
{type:'snapshot',version:2,serverTime,code,phase,countdownEndsAt,
 self:{id,ack:{epoch,frame:lastProcessedFrame,reason},simulation:captureSession(own.session),finished,finishTime},
 players:[{id,car,paint,epoch,state:{pos,quat,vel,angVel,speed,rpm,gear,ctrl:{brake},wheels:[{spinAngle,omega,steer,comp,contact}]}}],
 standings?:existingArray}.

The players array excludes the recipient. Full solver data is only sent for recipient's self. The acknowledgement reason identifies deliberate grid/recovery resets separately from safety corrections. Other-car wheel world positions are derived from body pose and spec (local hub y=attachY-restLen+comp). Standings v2 max2Hz plus forced race/phase changes; root retains last standings if omitted. Legacy peers receive old complete snapshots. Keep tests for legacy clients working.

