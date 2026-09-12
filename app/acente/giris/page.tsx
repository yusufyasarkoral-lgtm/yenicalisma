"use client";

import { FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Building2, ShieldCheck, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AgencySignInPage() {
  function showComingSoon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <main className="agency-login-page">
      <header className="agency-login-top">
        <Link className="brand" href="/">
          <span className="brand-icon"><ShieldCheck size={22} /></span>
          teklif<span className="brand-light">masası</span>
        </Link>
        <Link className="agency-login-back" href="/"><ArrowLeft size={16} /> Broker alanı</Link>
      </header>
      <section className="agency-login-shell" aria-labelledby="agency-login-title">
        <div className="agency-login-copy">
          <span className="portal-icon"><Building2 size={26} /></span>
          <p className="eyebrow">ACENTE PORTALI</p>
          <h1 id="agency-login-title">Teklif taleplerinizi<br />tek yerden yönetin.</h1>
          <p>Teklif süreçlerinizi güvenle takip edin, taleplerinizi tek ekrandan yönetin.</p>
          <div className="temporary-access-note"><Sparkles size={17} /><span>Geçici erişim modu aktif</span></div>
        </div>
        <form className="agency-login-card" onSubmit={showComingSoon}>
          <div className="agency-login-card-icon"><Building2 size={22} /></div>
          <h2>Acente girişi</h2>
          <p>Hesabınızla giriş yaparak devam edin.</p>
          <label htmlFor="email">E-posta adresi</label>
          <Input id="email" type="email" autoComplete="email" placeholder="ornek@acente.com" />
          <label htmlFor="password">Şifre</label>
          <Input id="password" type="password" autoComplete="current-password" placeholder="Şifrenizi girin" />
          <div className="agency-login-options"><label><input type="checkbox" /> Beni hatırla</label><button type="button">Şifremi unuttum</button></div>
          <Button type="submit" variant="outline" className="agency-login-button">Giriş yap <ArrowRight size={17} /></Button>
          <div className="agency-login-divider"><span>veya</span></div>
          <Button asChild className="agency-login-button"><Link href="/acente">Şimdilik direkt giriş yap <ArrowRight size={17} /></Link></Button>
          <small>Şifreli giriş altyapısı yakında aktif olacak.</small>
        </form>
      </section>
    </main>
  );
}
