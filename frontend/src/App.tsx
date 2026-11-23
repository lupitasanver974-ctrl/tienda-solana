import { useCallback, useEffect, useMemo, useState } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import idl from "./idl/tienda.json";
import { explorer, pdaProducto, pdaTienda, pdaVenta } from "./client";

export default function App() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const program = useMemo(() => {
    if (!wallet) return null;
    return new Program(idl as any, new AnchorProvider(connection, wallet, { commitment: "confirmed" })) as any;
  }, [connection, wallet]);

  const [tienda, setTienda] = useState<any>(null);
  const [productos, setProductos] = useState<any[]>([]);
  const [ventas, setVentas] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [sig, setSig] = useState("");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ nombre: "", sku: "", pnombre: "", precio: "", stock: "", cantidad: "1" });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  const owner = wallet?.publicKey;
  const pkTienda = program && owner ? pdaTienda(program.programId, owner) : null;

  const refrescar = useCallback(async () => {
    if (!program || !pkTienda) return;
    const t = await program.account.tienda.fetchNullable(pkTienda);
    setTienda(t);
    if (!t) { setProductos([]); setVentas([]); return; }
    const filtro = [{ memcmp: { offset: 8, bytes: pkTienda.toBase58() } }];
    setProductos(await program.account.producto.all(filtro));
    setVentas(await program.account.venta.all(filtro));
  }, [program, pkTienda]);

  useEffect(() => { refrescar().catch((e) => setMsg(String(e?.message ?? e))); }, [refrescar]);

  async function run(fn: () => Promise<string>, ok: string) {
    setBusy(true); setMsg(""); setSig("");
    try { const s = await fn(); setSig(s); setMsg("✅ " + ok); await refrescar(); }
    catch (e: any) { setMsg("❌ Rechazada: " + (e?.error?.errorMessage ?? e?.message ?? String(e))); }
    finally { setBusy(false); }
  }

  const prodKey = () => pdaProducto(program.programId, pkTienda!, f.sku.trim());

  return (
    <main>
      <header><h1>🏪 Tienda en Solana (Devnet)</h1><WalletMultiButton /></header>
      {!wallet && <p className="card">Conecta tu wallet Solflare (red Devnet) para empezar.</p>}

      {wallet && !tienda && (
        <section className="card">
          <h2>Crear mi tienda</h2>
          <input placeholder="Nombre de la tienda" value={f.nombre} onChange={set("nombre")} />
          <button disabled={busy} onClick={() => run(() => program.methods.crearTienda(f.nombre).accountsPartial({ owner, tienda: pkTienda }).rpc(), "Tienda creada")}>Crear tienda</button>
        </section>
      )}

      {wallet && tienda && (<>
        <section className="card">
          <h2>{tienda.nombre}</h2>
          <p>Productos: {tienda.totalProductos} · Ventas registradas: {tienda.totalVentas}</p>
        </section>

        <section className="card">
          <h2>Producto</h2>
          <div className="grid">
            <input placeholder="SKU (ej. CAF01)" value={f.sku} onChange={set("sku")} />
            <input placeholder="Nombre" value={f.pnombre} onChange={set("pnombre")} />
            <input placeholder="Precio" type="number" value={f.precio} onChange={set("precio")} />
            <input placeholder="Stock" type="number" value={f.stock} onChange={set("stock")} />
          </div>
          <div className="row">
            <button disabled={busy} onClick={() => run(() => program.methods.crearProducto(f.sku.trim(), f.pnombre, new BN(f.precio || 0), Number(f.stock || 0)).accountsPartial({ owner, tienda: pkTienda, producto: prodKey() }).rpc(), "Producto creado")}>Crear</button>
            <button disabled={busy} onClick={() => run(() => program.methods.actualizarProducto(new BN(f.precio || 0), Number(f.stock || 0)).accountsPartial({ owner, tienda: pkTienda, producto: prodKey() }).rpc(), "Producto actualizado")}>Actualizar precio/stock</button>
            <button disabled={busy} className="danger" onClick={() => run(() => program.methods.cerrarProducto().accountsPartial({ owner, tienda: pkTienda, producto: prodKey() }).rpc(), "Producto cerrado")}>Cerrar (stock 0)</button>
          </div>
        </section>

        <section className="card">
          <h2>Registrar venta</h2>
          <div className="row">
            <input placeholder="SKU" value={f.sku} onChange={set("sku")} />
            <input placeholder="Cantidad" type="number" value={f.cantidad} onChange={set("cantidad")} />
            <button disabled={busy} onClick={() => run(() => {
              const id = tienda.totalVentas;
              return program.methods.registrarVenta(id, Number(f.cantidad)).accountsPartial({ owner, tienda: pkTienda, producto: prodKey(), venta: pdaVenta(program.programId, prodKey(), id) }).rpc();
            }, "Venta registrada (stock descontado)")}>Vender</button>
          </div>
        </section>

        <section className="card">
          <h2>Inventario</h2>
          {productos.length === 0 && <p>Sin productos.</p>}
          {productos.map((p) => (
            <p key={p.publicKey.toBase58()}><b>{p.account.sku}</b> · {p.account.nombre} · ${p.account.precio.toString()} · stock {p.account.stock}</p>
          ))}
        </section>

        <section className="card">
          <h2>Ventas</h2>
          {ventas.length === 0 && <p>Sin ventas.</p>}
          {ventas.map((v) => (
            <div className="row" key={v.publicKey.toBase58()}>
              <span>#{v.account.id} · {v.account.cantidad} pza · total ${v.account.total.toString()}</span>
              <button disabled={busy} className="danger" onClick={() => run(() => program.methods.devolucion().accountsPartial({ owner, tienda: pkTienda, producto: v.account.producto, venta: v.publicKey }).rpc(), "Devolución hecha (venta cerrada, stock regresado)")}>Devolución</button>
            </div>
          ))}
        </section>
      </>)}

      {msg && <p className="msg">{msg}</p>}
      {sig && <p><a href={explorer(sig)} target="_blank" rel="noreferrer">Ver transacción en Explorer ↗</a></p>}
    </main>
  );
}
