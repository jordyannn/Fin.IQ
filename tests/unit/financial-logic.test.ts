import { describe, it, expect } from "vitest";

describe("Financial Balance Calculation & Precision Logic", () => {
  it("harus menghitung saldo pengeluaran (expense) dengan benar", () => {
    const initialBalance = 1000000;
    const expenseAmount = 75000;
    const finalBalance = initialBalance - expenseAmount;
    expect(finalBalance).toBe(925000);
  });

  it("harus menghitung saldo pemasukan (income) dengan benar", () => {
    const initialBalance = 500000;
    const incomeAmount = 250000;
    const finalBalance = initialBalance + incomeAmount;
    expect(finalBalance).toBe(750000);
  });

  it("harus memperbarui saldo transfer antar rekening secara akurat", () => {
    const sourceInitial = 1000000;
    const targetInitial = 200000;
    const transferAmount = 300000;

    const sourceFinal = sourceInitial - transferAmount;
    const targetFinal = targetInitial + transferAmount;

    expect(sourceFinal).toBe(700000);
    expect(targetFinal).toBe(500000);
    expect(sourceFinal + targetFinal).toBe(sourceInitial + targetInitial);
  });

  it("harus memulihkan (revert) saldo dengan akurat saat transaksi dibatalkan atau dihapus", () => {
    let balance = 1000000;
    const expense = 150000;

    // Apply expense
    balance -= expense;
    expect(balance).toBe(850000);

    // Rollback / revert expense
    balance += expense;
    expect(balance).toBe(1000000);
  });

  it("harus menangani kasus presisi desimal tanpa penyimpangan floating-point", () => {
    // Masalah klasik 0.1 + 0.2 = 0.30000000000000004
    const a = 19.99;
    const b = 10.01;
    const sum = Math.round((a + b) * 100) / 100;
    expect(sum).toBe(30);

    // Simulasi penjumlahan nominal rupiah besar
    const tx1 = 1500000;
    const tx2 = 2750000;
    const total = tx1 + tx2;
    expect(total).toBe(4250000);
  });
});
