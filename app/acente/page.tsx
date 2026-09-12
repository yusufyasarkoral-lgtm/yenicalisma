"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "@/app/chat-widget.css";
import {
  ArrowLeft,
  MessageCircle,
  Send,
  ShieldCheck,
  X,
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

type ApiError = { error?: string };
type CreatedRequest = { id: string; assistantMessage: string } & ApiError;
type ChatResponse = {
  status: string;
  fields?: State["fields"];
  missing?: State["missing"];
  branch?: { key: string; label: string } | null;
  summary?: string;
  assistantMessage: string;
} & ApiError;

const INITIAL_MESSAGE =
  "Merhaba! Hangi sigorta branşı için teklif almak istediğinizi ve bildiğiniz detayları yazabilirsiniz.";

export default function AgencyPortal() {
  const [sessionStatus, setSessionStatus] =
    useState<SessionStatus>("loading");

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

  const [chatOpen, setChatOpen] =
    useState(false);

  const [error, setError] =
    useState("");

  async function loadAgencySession() {
    setSessionStatus("loading");
    setError("");

    try {
      const response = await fetch("/api/agencies/onboard", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json() as ApiError;

      if (
        response.status === 403 &&
        data.error === "onboarding_required"
      ) {
        setSessionStatus("onboarding_required");
        return;
      }

      if (!response.ok) {
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

      setSessionStatus("ready");
    } catch {
      setSessionStatus("error");
      setError("Acente oturumu yüklenemedi.");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAgencySession(), 0);
    return () => window.clearTimeout(timer);
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

        const data = await response.json() as State;

        if (cancelled) {
          return;
        }

        setState(data);

        const restoredMessages = data.messages.map((message) => ({
            role: message.role === "user" ? "user" as const : "bot" as const,
            content: message.content,
          }));
        setMessages(
          restoredMessages.length ? restoredMessages : [{ role: "bot", content: INITIAL_MESSAGE }],
        );
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

      const data = await response.json() as ApiError;

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

        const created =
          await createResponse.json() as CreatedRequest;

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

      const data = await response.json() as ChatResponse;

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
      setMessages((current) => {
        const index = current.map((message, position) =>
          message.role === "user" && message.content === content ? position : -1,
        ).lastIndexOf(current.length - 1);
        return index === -1 ? current : current.filter((_, position) => position !== index);
      });
    } finally {
      setBusy(false);
    }
  }

  const progress = state
    ? state.status === "ready_for_review"
      ? 100
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
          <Link
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
          </Link>

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
          <Link
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
          </Link>

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
          <Link
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
          </Link>

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
        <Link
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
        </Link>

        <span>ACENTE PORTALI</span>
      </header>

      <section className="agency-shell">
        <Button
          variant="ghost"
          className="back-link"
          onClick={() => window.location.assign("/panel")}
        >
          <ArrowLeft size={16} />
          Broker ekranına dön
        </Button>

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

        {chatOpen && <div className="agency-layout chat-widget-layout">
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

              <div className="chat-head-actions">
                <b>{progress}%</b>
                <Button
                  aria-label="Sohbeti kapat"
                  variant="ghost"
                  size="icon"
                  onClick={() => setChatOpen(false)}
                >
                  <X size={18} />
                </Button>
              </div>
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

            <div className="chat-compose">
              <Input
                value={text}
                disabled={busy}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void send()}
                placeholder="Mesajınızı yazın…"
              />

              <Button
                size="icon"
                disabled={busy || !text.trim()}
                onClick={() => void send()}
              >
                <Send size={17} />
              </Button>
            </div>

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
                {state?.status === "ready_for_review"
                  ? "Özet hazır; gerekli bilgileri düzeltebilirsiniz."
                  : "Eksik bilgiler konuşarak tamamlanıyor."}
              </p>
            </div>

            {state?.ai_summary &&
              state.status === "ready_for_review" && (
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

          </aside>
        </div>}

        {!chatOpen && <Button className="chat-launch" onClick={() => setChatOpen(true)}>
          <MessageCircle size={22} />
          <span>Teklif asistanı</span>
        </Button>}
      </section>
    </main>
  );
}
