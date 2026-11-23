import { PublicKey } from "@solana/web3.js";

export const idBuf = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };

export const pdaTienda = (programId: PublicKey, owner: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("tienda"), owner.toBuffer()], programId)[0];

export const pdaProducto = (programId: PublicKey, tienda: PublicKey, sku: string) =>
  PublicKey.findProgramAddressSync([Buffer.from("producto"), tienda.toBuffer(), Buffer.from(sku)], programId)[0];

export const pdaVenta = (programId: PublicKey, producto: PublicKey, id: number) =>
  PublicKey.findProgramAddressSync([Buffer.from("venta"), producto.toBuffer(), idBuf(id)], programId)[0];

export const explorer = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
