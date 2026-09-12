import argparse
import sys
import time

import pandas as pd

from data_gen import agregar_transaccion
from config import CATEGORIAS, USUARIOS

OK = "\033[92m"
BOLD = "\033[1m"
RESET = "\033[0m"
CIAN = "\033[96m"


def _elegir(lista: list[str], prompt: str, enumerar=True) -> str:
    for i, opcion in enumerate(lista, start=1):
        print(f"  {BOLD}{CIAN}{i}.{RESET} {opcion}")
    while True:
        if enumerar:
            try:
                sel = int(input(prompt))
                if 1 <= sel <= len(lista):
                    return lista[sel - 1]
            except ValueError:
                pass
            print("  Selección inválida, intenta de nuevo.")
        else:
            return input(prompt).strip()


def insertar_interactivo() -> None:
    print(f"\n{BOLD}SIMULADOR DE NUEVA TRANSACCIÓN{RESET}\n")
    print("¿Para qué usuario se registra la transacción?")
    usuario = _elegir(USUARIOS, "  Usuario (número): ")
    print("\n¿Categoría?")
    categoria = _elegir(CATEGORIAS, "  Categoría (número): ")
    while True:
        try:
            monto = float(input("\n  Monto (MXN): ").replace(",", ""))
            if monto > 0:
                break
            print("  El monto debe ser mayor a 0.")
        except ValueError:
            print("  Monto inválido.")
    descripcion = input("  Descripción: ").strip() or "Transacción simulada"

    print(f"\n  Insertando {BOLD}${monto:,.2f} MXN{RESET} para {BOLD}{usuario}{RESET} [{categoria}]...")
    time.sleep(0.8)
    nueva = agregar_transaccion(usuario=usuario, monto=monto, categoria=categoria, descripcion=descripcion)
    print(f"{OK}✔ Transacción #{int(nueva['id_transaccion'])} insertada en transacciones.csv{RESET}\n")


def demo_rapida() -> None:
    casos = [
        ("Ruben Perez", 7800.00, "Compras", "Compra relámpago en tienda departamental"),
        ("Hector Barrera", 18500.00, "Servicios", "Empresa de servicios digitales - cargo único"),
        ("Hector Castro", 5200.00, "Salud", "Laboratorios y estudios clínicos"),
        ("Javier Ortiz", 3100.00, "Comida", "Cena ejecutiva en restaurante premium"),
    ]
    print(f"\n{BOLD}Insertando {len(casos)} transacciones de prueba...{RESET}\n")
    for usuario, monto, categoria, desc in casos:
        nueva = agregar_transaccion(usuario=usuario, monto=monto, categoria=categoria, descripcion=desc)
        print(f"  → #{int(nueva['id_transaccion'])}  {usuario}  ${monto:,.2f}  [{categoria}]")
        time.sleep(0.8)


def main() -> None:
    parser = argparse.ArgumentParser(description="Simulador de inserción de transacciones")
    parser.add_argument("--usuario", help="Usuario fijo (predefinido)")
    parser.add_argument("--monto", type=float, help="Monto en MXN")
    parser.add_argument("--categoria", help="Categoría")
    parser.add_argument("--descripcion", default="Transacción simulada", help="Descripción")
    parser.add_argument("--demo", action="store_true", help="Insertar casos de prueba que disparan alertas")
    args = parser.parse_args()

    if args.demo:
        demo_rapida()
        return

    if args.usuario and args.monto:
        if args.usuario not in USUARIOS:
            sys.exit(f"Usuario inválido: {args.usuario}. Usuarios: {USUARIOS}")
        if args.categoria is None:
            args.categoria = _elegir(CATEGORIAS, "Categoría (número): ")
        nueva = agregar_transaccion(
            usuario=args.usuario, monto=args.monto, categoria=args.categoria, descripcion=args.descripcion
        )
        print(f"{OK}✔ Transacción #{int(nueva['id_transaccion'])} insertada ({args.monto:,.2f} MXN).{RESET}")
        return

    insertar_interactivo()


if __name__ == "__main__":
    main()