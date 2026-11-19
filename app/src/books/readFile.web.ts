export async function readText(uri: string): Promise<string> { return (await fetch(uri)).text(); }
export async function readBytes(uri: string): Promise<Uint8Array> { return new Uint8Array(await (await fetch(uri)).arrayBuffer()); }
