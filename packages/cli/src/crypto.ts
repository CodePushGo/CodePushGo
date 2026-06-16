import { Buffer } from 'node:buffer'
import { constants, createCipheriv, createDecipheriv, generateKeyPairSync, privateEncrypt, publicDecrypt, randomBytes } from 'node:crypto'

const algorithm = 'aes-128-cbc'
const rsaPadding = constants.RSA_PKCS1_PADDING

export interface RSAKeys {
  publicKey: string
  privateKey: string
}

export interface EncryptedBundle {
  bytes: Uint8Array
  checksum: string
  sessionKey: string
  keyId: string
}

export function createRSAKeys(): RSAKeys {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  return {
    publicKey: publicKey.export({ type: 'pkcs1', format: 'pem' }) as string,
    privateKey: privateKey.export({ type: 'pkcs1', format: 'pem' }) as string,
  }
}

export function calcKeyId(publicKey: string): string {
  return publicKey
    .replace(/-----BEGIN RSA PUBLIC KEY-----/g, '')
    .replace(/-----END RSA PUBLIC KEY-----/g, '')
    .replace(/[\s]/g, '')
    .slice(0, 20)
}

export function generateSessionKey(privateKey: string) {
  const initVector = randomBytes(16)
  const sessionKey = randomBytes(16)
  const encryptedSessionKey = privateEncrypt({ key: privateKey, padding: rsaPadding }, sessionKey).toString('base64')
  return {
    sessionKey,
    encodedSessionKey: `${initVector.toString('base64')}:${encryptedSessionKey}`,
  }
}

export function encryptSource(source: Uint8Array, sessionKey: Buffer, encodedSessionKey: string): Uint8Array {
  const [iv] = encodedSessionKey.split(':')
  const cipher = createCipheriv(algorithm, sessionKey, Buffer.from(iv!, 'base64'))
  cipher.setAutoPadding(true)
  return new Uint8Array(Buffer.concat([cipher.update(source), cipher.final()]))
}

export function decryptSource(source: Uint8Array, encodedSessionKey: string, publicKey: string): Uint8Array {
  const [iv, encryptedSessionKey] = encodedSessionKey.split(':')
  const sessionKey = publicDecrypt({ key: publicKey, padding: rsaPadding }, Buffer.from(encryptedSessionKey!, 'base64'))
  const decipher = createDecipheriv(algorithm, sessionKey, Buffer.from(iv!, 'base64'))
  decipher.setAutoPadding(true)
  return new Uint8Array(Buffer.concat([decipher.update(source), decipher.final()]))
}

export function encryptChecksum(checksum: string, privateKey: string): string {
  return privateEncrypt({ key: privateKey, padding: rsaPadding }, Buffer.from(checksum, 'hex')).toString('hex')
}

export function decryptChecksum(checksum: string, publicKey: string): string {
  return publicDecrypt({ key: publicKey, padding: rsaPadding }, Buffer.from(checksum, 'hex')).toString('hex')
}

export function encryptBundle(bytes: Uint8Array, checksum: string, privateKey: string, publicKey: string): EncryptedBundle {
  const { sessionKey, encodedSessionKey } = generateSessionKey(privateKey)
  return {
    bytes: encryptSource(bytes, sessionKey, encodedSessionKey),
    checksum: encryptChecksum(checksum, privateKey),
    sessionKey: encodedSessionKey,
    keyId: calcKeyId(publicKey),
  }
}
