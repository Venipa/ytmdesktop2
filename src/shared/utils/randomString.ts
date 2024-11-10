import { Buffer } from 'buffer';
import { enc, lib } from 'crypto-js';
import { base64 } from './base64';
/**
 * Generates a random string of a given size
 */
export function generateRandom(size: number): string {
  const bits = (size + 1) * 6;
  const buffer = Buffer.from(lib.WordArray.random(Math.ceil(bits / 8)).toString(enc.Hex), 'hex');
  return base64.urlEncode(buffer).slice(0, size);
}
