# 🏪 Tienda en Solana: inventario y ventas con PDAs (Devnet)

Mejora funcional al proyecto de clase *Registro de ventas*: se añade **inventario**. Cada venta descuenta stock y cada devolución lo regresa.

- **Program ID (Devnet):** `PEGA_AQUI_TU_PROGRAM_ID`
- **Transacción verificable:** `PEGA_AQUI_EL_LINK_DE_EXPLORER`

## Cuentas (PDAs)
| Cuenta | Semillas | Qué guarda |
|---|---|---|
| Tienda | `"tienda"` + owner | nombre, contadores |
| Producto | `"producto"` + tienda + sku | nombre, precio, stock |
| Venta | `"venta"` + producto + id (u32 LE) | cantidad, total, fecha |

## Instrucciones
| Instrucción | Operación | Validaciones |
|---|---|---|
| `crear_tienda` | Crear | nombre 1–32 |
| `crear_producto` | Crear | solo la autoridad (`has_one = owner`), sku 1–16, precio > 0 |
| `actualizar_producto` | Actualizar | firma + autoridad |
| `registrar_venta` | Crear + actualizar stock | stock suficiente, id consecutivo, cantidad > 0 |
| `cerrar_producto` | **Cierre condicionado** | solo si `stock == 0` |
| `devolucion` | **Cierre condicionado** | solo dentro de 7 días; regresa el stock |

Consultar = leer las cuentas desde el frontend (`program.account.*`), sin firmar.

## Cómo ejecutarlo
**Programa (Solana Playground):** pegar `programs/tienda/src/lib.rs` en `src/lib.rs` → Build → Devnet → Deploy → copiar el Program ID. Exportar el IDL a `idl/tienda.json` y `frontend/src/idl/tienda.json`.

**Frontend:**
```bash
cd frontend
npm install
npm run dev     # http://localhost:5173 (Solflare en Devnet)
```

**Pruebas (local):** `yarn install && anchor test` (`tests/tienda.ts`).

## Pruebas y evidencias
- Válidas: crear tienda/producto, vender, devolver, cerrar.
- Rechazo: stock insuficiente, id fuera de orden, intruso sin autoridad, cerrar producto con stock.
- Evidencias: capturas en `/evidencias` y la transacción verificable de arriba.
