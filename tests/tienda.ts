import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";
import { Tienda } from "../target/types/tienda";

describe("tienda", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Tienda as Program<Tienda>;
  const owner = provider.wallet.publicKey;

  const [tienda] = PublicKey.findProgramAddressSync([Buffer.from("tienda"), owner.toBuffer()], program.programId);
  const [producto] = PublicKey.findProgramAddressSync([Buffer.from("producto"), tienda.toBuffer(), Buffer.from("CAF01")], program.programId);
  const idBuf = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
  const venta = (n: number) => PublicKey.findProgramAddressSync([Buffer.from("venta"), producto.toBuffer(), idBuf(n)], program.programId)[0];

  const falla = async (p: Promise<any>, texto: string) => {
    try { await p; } catch (e: any) { assert.include(String(e), texto); return; }
    assert.fail("Debió ser rechazada: " + texto);
  };

  it("crea tienda y producto", async () => {
    await program.methods.crearTienda("Mi Tienda").accountsPartial({ owner, tienda }).rpc();
    await program.methods.crearProducto("CAF01", "Cafe americano", new BN(100), 5).accountsPartial({ owner, tienda, producto }).rpc();
    assert.equal((await program.account.producto.fetch(producto)).stock, 5);
  });

  it("registra venta y descuenta stock", async () => {
    await program.methods.registrarVenta(0, 2).accountsPartial({ owner, tienda, producto, venta: venta(0) }).rpc();
    assert.equal((await program.account.producto.fetch(producto)).stock, 3);
    assert.equal((await program.account.venta.fetch(venta(0))).total.toNumber(), 200);
  });

  it("RECHAZA stock insuficiente", async () => {
    await falla(program.methods.registrarVenta(1, 99).accountsPartial({ owner, tienda, producto, venta: venta(1) }).rpc(), "StockInsuficiente");
  });

  it("RECHAZA un id de venta fuera de orden", async () => {
    await falla(program.methods.registrarVenta(7, 1).accountsPartial({ owner, tienda, producto, venta: venta(7) }).rpc(), "IdInvalido");
  });

  it("RECHAZA a un intruso (no es la autoridad)", async () => {
    const intruso = Keypair.generate();
    const sig = await provider.connection.requestAirdrop(intruso.publicKey, LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig);
    await falla(program.methods.actualizarProducto(new BN(1), 999).accountsPartial({ owner: intruso.publicKey, tienda, producto }).signers([intruso]).rpc(), "Error");
  });

  it("RECHAZA cerrar producto con stock", async () => {
    await falla(program.methods.cerrarProducto().accountsPartial({ owner, tienda, producto }).rpc(), "StockPendiente");
  });

  it("devolución: regresa stock y cierra la venta", async () => {
    await program.methods.devolucion().accountsPartial({ owner, tienda, producto, venta: venta(0) }).rpc();
    assert.equal((await program.account.producto.fetch(producto)).stock, 5);
    assert.isNull(await program.account.venta.fetchNullable(venta(0)));
  });

  it("cierra producto cuando el stock es 0", async () => {
    await program.methods.actualizarProducto(new BN(100), 0).accountsPartial({ owner, tienda, producto }).rpc();
    await program.methods.cerrarProducto().accountsPartial({ owner, tienda, producto }).rpc();
    assert.isNull(await program.account.producto.fetchNullable(producto));
  });
});
