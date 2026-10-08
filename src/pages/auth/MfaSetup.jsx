import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";

const MfaSetup = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [factor, setFactor] = useState(null);
  const [challengeId, setChallengeId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [setupAttempt, setSetupAttempt] = useState(0);
  const setupPromise = useRef(null);

  useEffect(() => {
    let active = true;
    const setup = async () => {
      try {
        if (!setupPromise.current) {
          setupPromise.current = (async () => {
            const { data: sessionData } = await supabase.auth.getSession();
            if (!sessionData.session) return { redirectToLogin: true };

            const [{ data: factorData, error: factorError }, { data: assuranceData, error: assuranceError }] = await Promise.all([
              supabase.auth.mfa.listFactors(),
              supabase.auth.mfa.getAuthenticatorAssuranceLevel()
            ]);
            if (factorError) throw factorError;
            if (assuranceError) throw assuranceError;

            if (assuranceData.currentLevel === "aal2") return { alreadyVerified: true };

            const verifiedFactor = factorData.totp?.find((item) => item.status === "verified");
            if (verifiedFactor) {
              const { data, error: challengeError } = await supabase.auth.mfa.challenge({
                factorId: verifiedFactor.id
              });
              if (challengeError) throw challengeError;
              return { factor: verifiedFactor, challengeId: data.id };
            }

            for (const pendingFactor of factorData.totp || []) {
              const { error: unenrollError } = await supabase.auth.mfa.unenroll({
                factorId: pendingFactor.id
              });
              if (unenrollError) throw unenrollError;
            }
            let { data, error: enrollError } = await supabase.auth.mfa.enroll({
              factorType: "totp",
              friendlyName: "FlashMonkey"
            });
            if (enrollError && /friendly name.*already exists/i.test(enrollError.message)) {
              ({ data, error: enrollError } = await supabase.auth.mfa.enroll({
                factorType: "totp",
                friendlyName: `FlashMonkey ${Date.now()}`
              }));
            }
            if (enrollError) throw enrollError;
            return {
              factor: data,
              qrCode: data.totp.qr_code,
              secret: data.totp.secret
            };
          })();
        }

        const result = await setupPromise.current;
        if (!active) return;
        if (result.redirectToLogin) {
          navigate("/login", { replace: true, state: { from: location } });
          return;
        }
        if (result.alreadyVerified) {
          navigate(location.state?.from?.pathname || "/", { replace: true });
          return;
        }

        setFactor(result.factor);
        setChallengeId(result.challengeId || "");
        setQrCode(result.qrCode || "");
        setSecret(result.secret || "");
      } catch (setupError) {
        console.error("Error preparando MFA:", setupError);
        if (active) {
          setError(setupError.message || "No se pudo preparar la autenticación MFA.");
          setLoading(false);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    setup();
    return () => {
      active = false;
    };
  }, [location, navigate, setupAttempt]);

  const reintentarPreparacion = () => {
    setupPromise.current = null;
    setError("");
    setFactor(null);
    setQrCode("");
    setSecret("");
    setLoading(true);
    setSetupAttempt((attempt) => attempt + 1);
  };

  const verificarCodigo = async (event) => {
    event.preventDefault();
    if (!factor?.id || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      let currentChallengeId = challengeId;
      if (!currentChallengeId) {
        const { data, error: challengeError } = await supabase.auth.mfa.challenge({
          factorId: factor.id
        });
        if (challengeError) throw challengeError;
        currentChallengeId = data.id;
      }
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: currentChallengeId,
        code: code.trim()
      });
      if (verifyError) throw verifyError;
      navigate(location.state?.from?.pathname || "/", { replace: true });
    } catch (verifyError) {
      console.error("Error verificando código MFA:", verifyError);
      setError(verifyError.message || "El código no es válido. Revisa tu aplicación de autenticación e inténtalo otra vez.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-9">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Protección de cuenta</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">Verificación en dos pasos</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Para proteger la información y los movimientos de dinero, usa Google Authenticator para escanear el código QR y confirmar tu acceso.</p>

        {loading ? (
          <p className="mt-6 text-sm text-slate-600" role="status">Preparando MFA...</p>
        ) : error && !factor ? (
          <div className="mt-6 space-y-4">
            <p className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>
            <button
              type="button"
              onClick={reintentarPreparacion}
              className="w-full rounded-lg border border-emerald-800 px-4 py-3 font-semibold text-emerald-900 hover:bg-emerald-50"
            >
              Reintentar configuración
            </button>
          </div>
        ) : (
          <>
            {qrCode && (
              <div className="mt-6 rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-800">1. Abre Google Authenticator y escanea este código QR</p>
                <img src={qrCode} alt="Código QR para configurar Google Authenticator" className="mx-auto mt-4 size-48" />
                <details className="mt-3 text-sm text-slate-600">
                  <summary className="cursor-pointer font-medium">No puedo escanear el código</summary>
                  <code className="mt-2 block break-all rounded bg-slate-50 p-2">{secret}</code>
                </details>
              </div>
            )}
            <form onSubmit={verificarCodigo} className="mt-6 space-y-4">
              <label className="block text-sm font-semibold text-slate-700" htmlFor="mfa-code">
                {qrCode ? "2. Escribe el código de seis dígitos de Google Authenticator" : "Ingresa el código de seis dígitos de Google Authenticator"}
                <input
                  id="mfa-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  minLength={6}
                  maxLength={6}
                  required
                  className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-center text-xl tracking-[0.4em] outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                />
              </label>
              {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
              <button disabled={submitting || loading} className="w-full rounded-lg bg-emerald-800 px-4 py-3 font-semibold text-white hover:bg-emerald-900 disabled:opacity-60">
                {submitting ? "Verificando..." : qrCode ? "Activar y verificar MFA" : "Verificar y continuar"}
              </button>
            </form>
          </>
        )}
        <Link to="/login" className="mt-5 block text-center text-sm font-semibold text-emerald-800 hover:underline">Cerrar sesión</Link>
      </section>
    </main>
  );
};

export default MfaSetup;
