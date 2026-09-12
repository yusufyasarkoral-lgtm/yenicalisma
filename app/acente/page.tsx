"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  FileUp,
  MessageCircle,
  Paperclip,
  Send,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Msg = {
  role: "bot" | "user";
  content: string;
};

type State = {
  id: string;
  status: string;
  branch_label: string;
  fields: Record<string, { value: string | number | boolean }>;
  missing: {
    required: string[];
    recommended: string[];
  };
  ai_summary: string;
  messages: Msg[];
};

type SessionStatus =
  | "loading"
  | "onboarding_required"
  | "ready"
  | "error";

type AgencySession = {
  authenticatedUserId: string;
  agencyUserId: string;
  agencyId: string;
  role: string;
};

const INITIAL_MESSAGE =
  "Merhaba! Hangi sigorta branşı için teklif almak istediğinizi ve bildiğiniz detayları yazabilirsiniz.";

export default function AgencyPortal() {
  const [sessionStatus, setSessionStatus] =
    useState<SessionStatus>("loading");

  const [session, setSession] = useState<AgencySession | null>(null);

  const [onboardingAgencyName, setOnboardingAgencyName] =
    useState("");

  const [onboardingBusy, setOnboardingBusy] =
    useState(false);

  const [state, setState] =
    useState<State | null>(null);

  const [messages, setMessages] =
    useState<Msg[]>([]);

  const [text, setText] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const [newQuoteBusy, setNewQuoteBusy] =
    useState(false);

  const [files, setFiles] =
    useState<File[]>([]);

  const [error, setError] =
    useState("");

  const fileRef =
    useRef<HTMLInputElement>(null);

  async function loadAgencySession() {
    setSessionStatus("loading");
    setError("");

    try {
      const response = await fetch("/api/agencies/onboard", {
        method: "GET",
        cache: "no-store",
      });

      const data: any = await response.json();

      if (
        response.status === 403 &&
        data.error === "onboarding_required"
      ) {
        setSession(null);
        setSessionStatus("onboarding_required");
        return;
      }

      if (!response.ok) {
        setSession(null);
        setSessionStatus("error");

        if (response.status === 401) {
          setError(
            "Oturum doğrulanamadı. Lütfen sayfayı yeniden açın.",
          );
        } else {
          setError(
            data.error ||
              "Acente oturumu yüklenemedi.",
          );
        }

        return;
      }

      setSession(data);
      setSessionStatus("ready");
    } catch {
      setSession(null);
      setSessionStatus("error");
      setError("Acente oturumu yüklenemedi.");
    }
  }

  useEffect(() => {
    void loadAgencySession();
  }, []);

  useEffect(() => {
    if (sessionStatus !== "ready") {
      return;
    }

    let cancelled = false;

    async function restoreDraft() {
      const id =
        localStorage.getItem("quote-request-id");

      if (!id) {
        if (!cancelled) {
          setState(null);
          setMessages([
            {
              role: "bot",
              content: INITIAL_MESSAGE,
            },
          ]);
        }

        return;
      }

      try {
        const response = await fetch(
          "/api/quote-requests?id=" +
            encodeURIComponent(id),
        );

        if (!response.ok) {
          localStorage.removeItem(
            "quote-request-id",
          );

          if (!cancelled) {
            setState(null);
            setMessages([
              {
                role: "bot",
                content: INITIAL_MESSAGE,
              },
            ]);
          }

          return;
        }

        const data: any = await response.json();

        if (cancelled) {
          return;
        }

        setState(data);

        setMessages(
          data.messages.map((message: any) => ({
            role:
              message.role === "user"
                ? "user"
                : "bot",
            content: message.content,
          })),
        );

        if (data.ai_summary) {
          setMessages((current) => [
            ...current,
            {
              role: "bot",
              content: data.ai_summary,
            },
          ]);
        }
      } catch {
        if (!cancelled) {
          setError(
            "Mevcut teklif talebi yüklenemedi.",
          );
        }
      }
    }

    void restoreDraft();

    return () => {
      cancelled = true;
    };
  }, [sessionStatus]);

  async function completeOnboarding() {
    const agencyName =
      onboardingAgencyName.trim();

    if (!agencyName || onboardingBusy) {
      return;
    }

    setOnboardingBusy(true);
    setError("");

    try {
      const response = await fetch(
        "/api/agencies/onboard",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            agencyName,
          }),
        },
      );

      const data: any = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Onboarding tamamlanamadı.",
        );
      }

      await loadAgencySession();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Onboarding tamamlanamadı.",
      );
    } finally {
      setOnboardingBusy(false);
    }
  }

  async function send() {
    if (!text.trim() || busy) {
      return;
    }

    const content = text.trim();

    setText("");
    setError("");

    setMessages((current) => [
      ...current,
      {
        role: "user",
        content,
      },
    ]);

    setBusy(true);

    let activeState = state;

    try {
      if (!activeState) {
        const createResponse =
          await fetch("/api/quote-requests", {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({}),
          });

        const created: any =
          await createResponse.json();

        if (!createResponse.ok) {
          throw new Error(
            created.error ||
              "Teklif talebi oluşturulamadı.",
          );
        }

        localStorage.setItem(
          "quote-request-id",
          created.id,
        );

        activeState = {
          id: created.id,
          status: "collecting_information",
          branch_label: "",
          fields: {},
          missing: {
            required: [],
            recommended: [],
          },
          ai_summary: "",
          messages: [],
        };

        setState(activeState);
      }

      const response = await fetch(
        "/api/quote-requests",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            id: activeState.id,
            message: content,
          }),
        },
      );

      const data: any = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Mesaj gönderilemedi.",
        );
      }

      setState((current) => {
        const base =
          current || activeState;

        if (!base) {
          return current;
        }

        return {
          ...base,
          status: data.status,
          fields:
            data.fields || base.fields,
          missing:
            data.missing || base.missing,
          branch_label:
            data.branch?.label ||
            base.branch_label,
          ai_summary:
            data.summary ||
            data.assistantMessage,
        };
      });

      setMessages((current) => [
        ...current,
        {
          role: "bot",
          content: data.assistantMessage,
        },
      ]);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Mesaj gönderilemedi.",
      );

      setText(content);
    } finally {
      setBusy(false);
    }
  }

  async function createNewQuote() {
    if (newQuoteBusy) {
      return;
    }

    setNewQuoteBusy(true);
    setError("");

    try {
      const response = await fetch(
        "/api/quote-requests",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({}),
        },
      );

      const created: any =
        await response.json();

      if (!response.ok) {
        throw new Error(
          created.error ||
            "Yeni teklif talebi oluşturulamadı.",
        );
      }

      localStorage.setItem(
        "quote-request-id",
        created.id,
      );

      setState({
        id: created.id,
        status: "collecting_information",
        branch_label: "",
        fields: {},
        missing: {
          required: [],
          recommended: [],
        },
        ai_summary: "",
        messages: [],
      });

      setMessages([
        {
          role: "bot",
          content: INITIAL_MESSAGE,
        },
      ]);

      setText("");
      setFiles([]);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Yeni teklif talebi oluşturulamadı.",
      );
    } finally {
      setNewQuoteBusy(false);
    }
  }

  async function upload(
    list: FileList | null,
  ) {
    if (!list || !state) {
      return;
    }

    setFiles([...list]);

    for (const file of [...list]) {
      const form = new FormData();

      form.append("quoteId", state.id);
      form.append("file", file);
      form.append(
        "category",
        "Teklif belgesi",
      );
      form.append(
        "source",
        "Acente portalı",
      );

      await fetch("/api/documents", {
        method: "POST",
        body: form,
      });
    }
  }

  const progress = state
    ? state.status === "submitted"
      ? 100
      : state.status ===
          "awaiting_confirmation"
        ? 90
        : Math.max(
            10,
            100 -
              (state.missing.required.length *
                20 +
                state.missing.recommended
                  .length *
                  8),
          )
    : 0;

  if (sessionStatus === "loading") {
    return (
      <main className="agency-page">
        <header className="agency-top">
          <a
            className="brand"
            href="/"
          >
            <span className="brand-icon">
              <ShieldCheck size={22} />
            </span>
            teklif
            <span className="brand-light">
              masası
            </span>
          </a>

          <span>ACENTE PORTALI</span>
        </header>

        <section className="agency-shell">
          <div className="chat-card">
            <div className="messages">
              <div className="chat-message bot">
                <p>
                  Acente hesabınız
                  yükleniyor…
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (
    sessionStatus ===
    "onboarding_required"
  ) {
    return (
      <main className="agency-page">
        <header className="agency-top">
          <a
            className="brand"
            href="/"
          >
            <span className="brand-icon">
              <ShieldCheck size={22} />
            </span>
            teklif
            <span className="brand-light">
              masası
            </span>
          </a>

          <span>ACENTE PORTALI</span>
        </header>

        <section className="agency-shell">
          <div className="agency-intro">
            <span className="portal-icon">
              <ShieldCheck size={24} />
            </span>

            <div>
              <p className="eyebrow">
                ACENTE ONBOARDING
              </p>

              <h1>
                Acente hesabınızı
                oluşturun
              </h1>

              <p>
                Teklif süreçlerini
                başlatmak için acente
                adınızı girin.
              </p>
            </div>
          </div>

          <div className="agency-layout">
            <section className="chat-card">
              <div className="chat-compose">
                <Input
                  value={
                    onboardingAgencyName
                  }
                  disabled={
                    onboardingBusy
                  }
                  onChange={(e) =>
                    setOnboardingAgencyName(
                      e.target.value,
                    )
                  }
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    void completeOnboarding()
                  }
                  placeholder="Acente adı"
                />

                <Button
                  disabled={
                    onboardingBusy ||
                    !onboardingAgencyName.trim()
                  }
                  onClick={() =>
                    void completeOnboarding()
                  }
                >
                  Acente hesabını oluştur
                </Button>
              </div>

              {error && (
                <p className="portal-error">
                  {error}
                </p>
              )}
            </section>
          </div>
        </section>
      </main>
    );
  }

  if (sessionStatus === "error") {
    return (
      <main className="agency-page">
        <header className="agency-top">
          <a
            className="brand"
            href="/"
          >
            <span className="brand-icon">
              <ShieldCheck size={22} />
            </span>
            teklif
            <span className="brand-light">
              masası
            </span>
          </a>

          <span>ACENTE PORTALI</span>
        </header>

        <section className="agency-shell">
          <div className="chat-card">
            <div className="messages">
              <div className="chat-message bot">
                <p>
                  {error ||
                    "Acente oturumu yüklenemedi."}
                </p>
              </div>
            </div>

            <Button
              onClick={() =>
                void loadAgencySession()
              }
            >
              Tekrar dene
            </Button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="agency-page">
      <header className="agency-top">
        <a
          className="brand"
          href="/"
        >
          <span className="brand-icon">
            <ShieldCheck size={22} />
          </span>
          teklif
          <span className="brand-light">
            masası
          </span>
        </a>

        <span>ACENTE PORTALI</span>
      </header>

      <section className="agency-shell">
        <a
          href="/"
          className="back-link"
        >
          <ArrowLeft size={16} />
          Broker ekranına dön
        </a>

        <div className="agency-intro">
          <span className="portal-icon">
            <MessageCircle size={24} />
          </span>

          <div>
            <p className="eyebrow">
              SOHBETLE TEKLİF TALEBİ
            </p>

            <h1>
              Talebini anlat,
              <br />
              birlikte tamamlayalım.
            </h1>

            <p>
              Asistan yalnız eksik
              bilgileri sorar; teklif
              onayınız olmadan
              gönderilmez.
            </p>
          </div>
        </div>

        <div className="agency-layout">
          <section className="chat-card">
            <div className="chat-head">
              <div>
                <strong>
                  Teklif asistanı
                </strong>

                <span>
                  <i /> Çevrimiçi
                </span>
              </div>

              <b>{progress}%</b>
            </div>

            <div className="chat-progress">
              <span
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>

            <div className="messages">
              {messages.map(
                (message, index) => (
                  <div
                    key={index}
                    className={`chat-message ${
                      message.role ===
                      "user"
                        ? "user"
                        : "bot"
                    }`}
                  >
                    <p>
                      {message.content}
                    </p>
                  </div>
                ),
              )}
            </div>

            {state?.status ===
            "submitted" ? (
              <div className="success-area">
                <Check size={20} />

                <span>
                  Talep broker
                  değerlendirmesine
                  iletildi
                </span>

                <Button
                  variant="outline"
                  disabled={newQuoteBusy}
                  onClick={() =>
                    void createNewQuote()
                  }
                >
                  {newQuoteBusy
                    ? "Oluşturuluyor…"
                    : "Yeni teklif oluştur"}
                </Button>
              </div>
            ) : (
              <div className="chat-compose">
                <Input
                  value={text}
                  disabled={busy}
                  onChange={(e) =>
                    setText(
                      e.target.value,
                    )
                  }
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    void send()
                  }
                  placeholder="Mesajınızı yazın…"
                />

                <Button
                  size="icon"
                  disabled={
                    busy || !text.trim()
                  }
                  onClick={() =>
                    void send()
                  }
                >
                  <Send size={17} />
                </Button>
              </div>
            )}

            {error && (
              <p className="portal-error">
                {error}
              </p>
            )}
          </section>

          <aside className="portal-side">
            <div className="portal-note">
              <strong>
                {state?.branch_label ||
                  "Teklif talebi"}
              </strong>

              <p>
                {state?.status ===
                "awaiting_confirmation"
                  ? "Özet hazır; onayınızı bekliyoruz."
                  : state?.status ===
                      "submitted"
                    ? "Broker değerlendirmesine iletildi."
                    : "Eksik bilgiler konuşarak tamamlanıyor."}
              </p>
            </div>

            {state?.ai_summary &&
              state.status ===
                "awaiting_confirmation" && (
                <div className="portal-note">
                  <strong>
                    Teklif özeti
                  </strong>

                  <p
                    style={{
                      whiteSpace:
                        "pre-line",
                    }}
                  >
                    {state.ai_summary}
                  </p>
                </div>
              )}

            <div className="upload-card">
              <FileUp size={22} />

              <h2>Belge ekle</h2>

              <p>
                PDF veya görsel olarak
                belge ekleyebilirsiniz.
              </p>

              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                multiple
                hidden
                onChange={(e) =>
                  void upload(
                    e.target.files,
                  )
                }
              />

              <Button
                variant="outline"
                disabled={!state}
                onClick={() =>
                  fileRef.current?.click()
                }
              >
                <Paperclip size={16} />
                Belge seç
              </Button>

              {files.map((file) => (
                <p key={file.name}>
                  {file.name}
                </p>
              ))}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
