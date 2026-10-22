"use client";

import React from "react";
import {
  Utensils,
  Coffee,
  Cookie,
  Car,
  ShoppingBag,
  ShoppingCart,
  Zap,
  Heart,
  Activity,
  Gamepad2,
  GraduationCap,
  Banknote,
  TrendingUp,
  PiggyBank,
  Briefcase,
  Home,
  Shirt,
  Gift,
  Receipt,
  Layers,
  Wallet,
  CreditCard,
  Folder,
  Tag,
} from "lucide-react";

export interface CategoryIconProps extends Omit<React.SVGAttributes<SVGSVGElement>, "name"> {
  icon?: string | null;
  name?: string | null;
  className?: string;
}

/**
 * Normalizes icon string or infers an appropriate icon from category name
 */
export function getCategoryIconName(icon?: string | null, name?: string | null): string {
  const normIcon = icon?.toLowerCase().trim();
  if (normIcon && normIcon !== "tag" && normIcon !== "wallet") {
    return normIcon;
  }

  if (name) {
    const n = name.toLowerCase().trim();
    if (
      n.includes("makan") ||
      n.includes("food") ||
      n.includes("resto") ||
      n.includes("kuliner") ||
      n.includes("nasi") ||
      n.includes("dining")
    )
      return "utensils";
    if (
      n.includes("kopi") ||
      n.includes("coffee") ||
      n.includes("cafe") ||
      n.includes("kafe") ||
      n.includes("boba") ||
      n.includes("minum") ||
      n.includes("beverage")
    )
      return "coffee";
    if (
      n.includes("snack") ||
      n.includes("camilan") ||
      n.includes("roti") ||
      n.includes("kue")
    )
      return "cookie";
    if (
      n.includes("transport") ||
      n.includes("bensin") ||
      n.includes("bbm") ||
      n.includes("ojol") ||
      n.includes("gojek") ||
      n.includes("grab") ||
      n.includes("parkir") ||
      n.includes("tol") ||
      n.includes("kendaraan") ||
      n.includes("motor") ||
      n.includes("mobil")
    )
      return "car";
    if (
      n.includes("belanja") ||
      n.includes("shopping") ||
      n.includes("supermarket") ||
      n.includes("minimarket") ||
      n.includes("indomaret") ||
      n.includes("alfamart") ||
      n.includes("mall") ||
      n.includes("pasar")
    )
      return "shopping-bag";
    if (
      n.includes("listrik") ||
      n.includes("pln") ||
      n.includes("air") ||
      n.includes("pdam") ||
      n.includes("internet") ||
      n.includes("wifi") ||
      n.includes("pulsa") ||
      n.includes("tagihan") ||
      n.includes("utilitas")
    )
      return "zap";
    if (
      n.includes("kesehatan") ||
      n.includes("sehat") ||
      n.includes("obat") ||
      n.includes("dokter") ||
      n.includes("apotek") ||
      n.includes("rumah sakit") ||
      n.includes("fitness") ||
      n.includes("gym") ||
      n.includes("olahraga")
    )
      return "heart";
    if (
      n.includes("game") ||
      n.includes("gaming") ||
      n.includes("hiburan") ||
      n.includes("nonton") ||
      n.includes("bioskop") ||
      n.includes("netflix") ||
      n.includes("rekreasi")
    )
      return "gamepad2";
    if (
      n.includes("pendidikan") ||
      n.includes("kursus") ||
      n.includes("buku") ||
      n.includes("sekolah") ||
      n.includes("kuliah") ||
      n.includes("les") ||
      n.includes("edukasi")
    )
      return "graduation-cap";
    if (
      n.includes("gaji") ||
      n.includes("salary") ||
      n.includes("upah") ||
      n.includes("bonus") ||
      n.includes("pendapatan") ||
      n.includes("income") ||
      n.includes("thr")
    )
      return "banknote";
    if (
      n.includes("investasi") ||
      n.includes("saham") ||
      n.includes("crypto") ||
      n.includes("reksadana") ||
      n.includes("dividen")
    )
      return "trending-up";
    if (
      n.includes("tabungan") ||
      n.includes("saving") ||
      n.includes("darurat")
    )
      return "piggy-bank";
    if (
      n.includes("bisnis") ||
      n.includes("usaha") ||
      n.includes("freelance") ||
      n.includes("klien") ||
      n.includes("proyek")
    )
      return "briefcase";
    if (
      n.includes("rumah") ||
      n.includes("kos") ||
      n.includes("kost") ||
      n.includes("kontrakan") ||
      n.includes("properti")
    )
      return "home";
    if (
      n.includes("baju") ||
      n.includes("pakaian") ||
      n.includes("fashion")
    )
      return "shirt";
    if (
      n.includes("hadiah") ||
      n.includes("gift") ||
      n.includes("sedekah") ||
      n.includes("zakat") ||
      n.includes("donasi")
    )
      return "gift";
    if (
      n.includes("pajak") ||
      n.includes("tax") ||
      n.includes("admin")
    )
      return "receipt";
    if (
      n.includes("langganan") ||
      n.includes("subscription")
    )
      return "layers";
  }

  return normIcon || "tag";
}

export function CategoryIcon({
  icon,
  name,
  className = "h-4 w-4",
  ...props
}: CategoryIconProps) {
  const iconKey = getCategoryIconName(icon, name);

  switch (iconKey) {
    case "utensils":
      return <Utensils className={className} {...props} />;
    case "coffee":
      return <Coffee className={className} {...props} />;
    case "cookie":
      return <Cookie className={className} {...props} />;
    case "car":
      return <Car className={className} {...props} />;
    case "shopping-bag":
    case "shoppingbag":
      return <ShoppingBag className={className} {...props} />;
    case "shopping-cart":
    case "shoppingcart":
      return <ShoppingCart className={className} {...props} />;
    case "zap":
      return <Zap className={className} {...props} />;
    case "piggy-bank":
    case "piggybank":
      return <PiggyBank className={className} {...props} />;
    case "heart":
      return <Heart className={className} {...props} />;
    case "activity":
      return <Activity className={className} {...props} />;
    case "graduation-cap":
    case "graduationcap":
      return <GraduationCap className={className} {...props} />;
    case "gamepad":
    case "gamepad2":
      return <Gamepad2 className={className} {...props} />;
    case "trending-up":
    case "trendingup":
      return <TrendingUp className={className} {...props} />;
    case "credit-card":
    case "creditcard":
      return <CreditCard className={className} {...props} />;
    case "banknote":
      return <Banknote className={className} {...props} />;
    case "briefcase":
      return <Briefcase className={className} {...props} />;
    case "wallet":
      return <Wallet className={className} {...props} />;
    case "home":
      return <Home className={className} {...props} />;
    case "shirt":
      return <Shirt className={className} {...props} />;
    case "gift":
      return <Gift className={className} {...props} />;
    case "receipt":
      return <Receipt className={className} {...props} />;
    case "layers":
      return <Layers className={className} {...props} />;
    case "folder":
      return <Folder className={className} {...props} />;
    default:
      return <Tag className={className} {...props} />;
  }
}
