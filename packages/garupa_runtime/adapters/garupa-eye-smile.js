// The common smile landmark is measured relative to the native blink field.
// Only complete a saturated, weak shape that actually opposes closing. Authored
// geometry is read at binding; the frame driver uses the compiled vector.
const SMILE_BLINK_AMPLITUDE = 0.06624160640756349;

function fieldDot(left, right, bindings) {
  let sum = 0;
  for (let i = 0; i < bindings.length; i++) {
    if (!left[i]) continue;
    const a = bindings[i];
    const aa = a.geometry.morphAttributes.position[a.index];
    for (let j = 0; j < bindings.length; j++) {
      if (!right[j] || bindings[j].object !== a.object) continue;
      const b = bindings[j];
      const bb = b.geometry.morphAttributes.position[b.index];
      for (let v = 0; v < aa.count; v++) {
        sum += left[i] * right[j] * (aa.getX(v) * bb.getX(v)
          + aa.getY(v) * bb.getY(v) + aa.getZ(v) * bb.getZ(v));
      }
    }
  }
  return sum;
}

export function calibrateOpenSmile(smile, close, closedSmile, bindings) {
  if (Math.max(...smile) < .999) return smile;
  const blinkNorm = fieldDot(close, close, bindings);
  const smileNorm = fieldDot(smile, smile, bindings);
  const targetNorm = SMILE_BLINK_AMPLITUDE ** 2 * blinkNorm;
  if (!(blinkNorm > 0 && smileNorm < .99 ** 2 * targetNorm)
    || fieldDot(smile, close, bindings) >= -1e-8 * blinkNorm) return smile;
  const winkNorm = fieldDot(closedSmile, closedSmile, bindings);
  if (!(winkNorm > 0)) return smile;
  const cross = fieldDot(smile, closedSmile, bindings);
  let amount = (-cross + Math.sqrt(cross * cross + winkNorm * (targetNorm - smileNorm))) / winkNorm;
  for (let i = 0; i < smile.length; i++) {
    if (closedSmile[i] > 0) amount = Math.min(amount, (1 - smile[i]) / closedSmile[i]);
  }
  if (!(amount > 0)) return smile;
  return Float64Array.from(smile, (value, i) => value + amount * closedSmile[i]);
}
