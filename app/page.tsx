import { ArrowRight, Building2, ShieldCheck, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SignInPage() {
  return (
    <main className="agency-login-page">
      <header className="agency-login-top">
        <a className="brand" href="/">
          <span className="brand-icon"><ShieldCheck size={22} /></span>
          teklif<span className="brand-light">masası</span>
        </a>
        <a className="agency-login-back" href="/acente/giris"><Building2 size={16} /> Acente girişi</a>
      </header>

      <section className="agency-login-shell" aria-labelledby="sign-in-title">
        <div className="agency-login-copy">
          <span className="portal-icon"><ShieldCheck size={26} /></span>
          <p className="eyebrow">BROKER ÇALIŞMA ALANI</p>
          <h1 id="sign-in-title">Tekliflerinizi<br />tek masadan yönetin.</h1>
          <p>Teklif, evrak ve acente süreçlerinizi tek bir çalışma alanında takip edin.</p>
          <div className="temporary-access-note"><Sparkles size={17} /><span>Geçici erişim modu aktif</span></div>
        </div>

        <form className="agency-login-card">
          <div className="agency-login-card-icon"><ShieldCheck size={22} /></div>
          <h2>Giriş yap</h2>
          <p>Hesabınızla giriş yaparak devam edin.</p>
          <label htmlFor="email">E-posta adresi</label>
          <Input id="email" type="email" autoComplete="email" placeholder="ornek@broker.com" />
          <label htmlFor="password">Şifre</label>
          <Input id="password" type="password" autoComplete="current-password" placeholder="Şifrenizi girin" />
          <div className="agency-login-options"><label><input type="checkbox" /> Beni hatırla</label><button type="button">Şifremi unuttum</button></div>
          <Button type="button" variant="outline" className="agency-login-button" disabled>Giriş yap <ArrowRight size={17} /></Button>
          <div className="agency-login-divider"><span>veya</span></div>
          <Button asChild className="agency-login-button"><a href="/panel">Şimdilik direkt giriş yap <ArrowRight size={17} /></a></Button>
          <small>Şifreli giriş altyapısı yakında aktif olacak.</small>
        </form>
      </section>
    </main>
  );
}
