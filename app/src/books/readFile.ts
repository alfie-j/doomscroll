import { File } from 'expo-file-system';
export async function readText(uri: string): Promise<string> { return new File(uri).text(); }
export async function readBytes(uri: string): Promise<Uint8Array> { return new File(uri).bytes(); }
