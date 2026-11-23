use anchor_lang::prelude::*;

// Solana Playground / `anchor keys sync` reemplazan este ID al compilar.
declare_id!("11111111111111111111111111111111");

const PLAZO_DEVOLUCION: i64 = 7 * 24 * 60 * 60; // 7 días

#[program]
pub mod tienda {
    use super::*;

    // CREA el registro de la tienda (PDA por dueño)
    pub fn crear_tienda(ctx: Context<CrearTienda>, nombre: String) -> Result<()> {
        require!(!nombre.is_empty() && nombre.len() <= 32, TiendaError::NombreInvalido);
        let t = &mut ctx.accounts.tienda;
        t.owner = ctx.accounts.owner.key();
        t.nombre = nombre;
        t.total_productos = 0;
        t.total_ventas = 0;
        t.bump = ctx.bumps.tienda;
        Ok(())
    }

    // CREA un producto (PDA: "producto" + tienda + sku)
    pub fn crear_producto(ctx: Context<CrearProducto>, sku: String, nombre: String, precio: u64, stock: u32) -> Result<()> {
        require!(!sku.is_empty() && sku.len() <= 16, TiendaError::SkuInvalido);
        require!(!nombre.is_empty() && nombre.len() <= 32, TiendaError::NombreInvalido);
        require!(precio > 0, TiendaError::PrecioInvalido);
        let p = &mut ctx.accounts.producto;
        p.tienda = ctx.accounts.tienda.key();
        p.sku = sku;
        p.nombre = nombre;
        p.precio = precio;
        p.stock = stock;
        p.bump = ctx.bumps.producto;
        let t = &mut ctx.accounts.tienda;
        t.total_productos = t.total_productos.checked_add(1).ok_or(TiendaError::Desbordamiento)?;
        Ok(())
    }

    // ACTUALIZA precio y stock (reabastecer)
    pub fn actualizar_producto(ctx: Context<ActualizarProducto>, precio: u64, stock: u32) -> Result<()> {
        require!(precio > 0, TiendaError::PrecioInvalido);
        let p = &mut ctx.accounts.producto;
        p.precio = precio;
        p.stock = stock;
        Ok(())
    }

    // CIERRE CONDICIONADO 1: solo se cierra un producto si su stock es 0
    pub fn cerrar_producto(ctx: Context<CerrarProducto>) -> Result<()> {
        let t = &mut ctx.accounts.tienda;
        t.total_productos = t.total_productos.saturating_sub(1);
        Ok(())
    }

    // CREA una venta (PDA: "venta" + producto + id) y descuenta inventario
    pub fn registrar_venta(ctx: Context<RegistrarVenta>, id: u32, cantidad: u32) -> Result<()> {
        require!(cantidad > 0, TiendaError::CantidadInvalida);
        require!(id == ctx.accounts.tienda.total_ventas, TiendaError::IdInvalido);
        let p = &mut ctx.accounts.producto;
        require!(p.stock >= cantidad, TiendaError::StockInsuficiente);
        p.stock -= cantidad;

        let v = &mut ctx.accounts.venta;
        v.tienda = ctx.accounts.tienda.key();
        v.producto = p.key();
        v.id = id;
        v.cantidad = cantidad;
        v.total = p.precio.checked_mul(cantidad as u64).ok_or(TiendaError::Desbordamiento)?;
        v.creada_en = Clock::get()?.unix_timestamp;
        v.bump = ctx.bumps.venta;

        let t = &mut ctx.accounts.tienda;
        t.total_ventas = t.total_ventas.checked_add(1).ok_or(TiendaError::Desbordamiento)?;
        Ok(())
    }

    // CIERRE CONDICIONADO 2: devolución solo dentro de 7 días; regresa el stock y cierra la venta
    pub fn devolucion(ctx: Context<Devolucion>) -> Result<()> {
        let ahora = Clock::get()?.unix_timestamp;
        let cantidad = ctx.accounts.venta.cantidad;
        require!(ahora - ctx.accounts.venta.creada_en <= PLAZO_DEVOLUCION, TiendaError::PlazoVencido);
        let p = &mut ctx.accounts.producto;
        p.stock = p.stock.checked_add(cantidad).ok_or(TiendaError::Desbordamiento)?;
        Ok(())
    }
}

// ---------- Cuentas (estado) ----------
#[account]
#[derive(InitSpace)]
pub struct Tienda {
    pub owner: Pubkey,
    #[max_len(32)]
    pub nombre: String,
    pub total_productos: u32,
    pub total_ventas: u32,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Producto {
    pub tienda: Pubkey, // primero: el frontend filtra por este campo (offset 8)
    #[max_len(16)]
    pub sku: String,
    #[max_len(32)]
    pub nombre: String,
    pub precio: u64,
    pub stock: u32,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Venta {
    pub tienda: Pubkey, // primero, por la misma razón
    pub producto: Pubkey,
    pub id: u32,
    pub cantidad: u32,
    pub total: u64,
    pub creada_en: i64,
    pub bump: u8,
}

// ---------- Contextos (permisos y validaciones) ----------
#[derive(Accounts)]
pub struct CrearTienda<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(init, payer = owner, space = 8 + Tienda::INIT_SPACE, seeds = [b"tienda", owner.key().as_ref()], bump)]
    pub tienda: Account<'info, Tienda>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(sku: String)]
pub struct CrearProducto<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, seeds = [b"tienda", owner.key().as_ref()], bump = tienda.bump, has_one = owner @ TiendaError::NoAutorizado)]
    pub tienda: Account<'info, Tienda>,
    #[account(init, payer = owner, space = 8 + Producto::INIT_SPACE, seeds = [b"producto", tienda.key().as_ref(), sku.as_bytes()], bump)]
    pub producto: Account<'info, Producto>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ActualizarProducto<'info> {
    pub owner: Signer<'info>,
    #[account(seeds = [b"tienda", owner.key().as_ref()], bump = tienda.bump, has_one = owner @ TiendaError::NoAutorizado)]
    pub tienda: Account<'info, Tienda>,
    #[account(mut, has_one = tienda @ TiendaError::NoAutorizado)]
    pub producto: Account<'info, Producto>,
}

#[derive(Accounts)]
pub struct CerrarProducto<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, seeds = [b"tienda", owner.key().as_ref()], bump = tienda.bump, has_one = owner @ TiendaError::NoAutorizado)]
    pub tienda: Account<'info, Tienda>,
    #[account(mut, close = owner, has_one = tienda @ TiendaError::NoAutorizado, constraint = producto.stock == 0 @ TiendaError::StockPendiente)]
    pub producto: Account<'info, Producto>,
}

#[derive(Accounts)]
#[instruction(id: u32)]
pub struct RegistrarVenta<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, seeds = [b"tienda", owner.key().as_ref()], bump = tienda.bump, has_one = owner @ TiendaError::NoAutorizado)]
    pub tienda: Account<'info, Tienda>,
    #[account(mut, has_one = tienda @ TiendaError::NoAutorizado)]
    pub producto: Account<'info, Producto>,
    #[account(init, payer = owner, space = 8 + Venta::INIT_SPACE, seeds = [b"venta", producto.key().as_ref(), &id.to_le_bytes()], bump)]
    pub venta: Account<'info, Venta>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Devolucion<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(seeds = [b"tienda", owner.key().as_ref()], bump = tienda.bump, has_one = owner @ TiendaError::NoAutorizado)]
    pub tienda: Account<'info, Tienda>,
    #[account(mut, has_one = tienda @ TiendaError::NoAutorizado)]
    pub producto: Account<'info, Producto>,
    #[account(mut, close = owner, has_one = tienda @ TiendaError::NoAutorizado, has_one = producto @ TiendaError::NoAutorizado,
        seeds = [b"venta", producto.key().as_ref(), &venta.id.to_le_bytes()], bump = venta.bump)]
    pub venta: Account<'info, Venta>,
}

// ---------- Errores ----------
#[error_code]
pub enum TiendaError {
    #[msg("Nombre inválido (1 a 32 caracteres)")] NombreInvalido,
    #[msg("SKU inválido (1 a 16 caracteres)")] SkuInvalido,
    #[msg("El precio debe ser mayor a 0")] PrecioInvalido,
    #[msg("La cantidad debe ser mayor a 0")] CantidadInvalida,
    #[msg("No eres la autoridad de esta tienda")] NoAutorizado,
    #[msg("Stock insuficiente")] StockInsuficiente,
    #[msg("Solo se puede cerrar un producto con stock 0")] StockPendiente,
    #[msg("El id de venta debe ser el siguiente consecutivo")] IdInvalido,
    #[msg("El plazo de devolución (7 días) venció")] PlazoVencido,
    #[msg("Desbordamiento numérico")] Desbordamiento,
}
