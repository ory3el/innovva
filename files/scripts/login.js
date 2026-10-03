const SUPABASE_URL = "https://sycnitxcfdctzpwpgxcv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_wH3L4RoNaxchI4RD2u5upA_qly1ocoK";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce"
  }
});

let userId = null;
let authBusy = false;
let pausedAccountModalOpen = false;
let pausedAccountChecking = false;

function showAuthLoading(title = "Aguarde...", message = "Processando") {
  if (typeof showLoadingModal === "function") showLoadingModal(title, message);
}

function hideAuthLoading() {
  if (typeof hideLoadingModal === "function") hideLoadingModal();
}

function authToast(message, type = "ok") {
  if (typeof toast === "function") toast(message, type);
}

function setAuthButtonLoading(button, loading, text) {
  if (!button) return;
  button.disabled = loading;
  button.classList.toggle("loading", loading);
  if (text) button.textContent = text;
}

function setAuthMode(register) {
  const loginMain = document.getElementById("loginMain");
  const registerMain = document.getElementById("registerMain");
  if (!loginMain || !registerMain) return;
  loginMain.hidden = register;
  registerMain.hidden = !register;
  const email = document.getElementById(register ? "regEmail" : "email");
  requestAnimationFrame(() => email?.focus());
}

async function doLogin() {
  if (authBusy) return;

  const email = document.getElementById("email");
  const password = document.getElementById("password");
  const btn = document.getElementById("signInBtn");
  const emailValue = email?.value.trim() || "";
  const passwordValue = password?.value || "";

  email?.classList.remove("err");
  password?.classList.remove("err");

  if (!validateEmail(emailValue)) {
    email?.classList.add("err");
    authToast("Digite um e-mail válido.", "err");
    email?.focus();
    return;
  }

  if (!passwordValue) {
    password?.classList.add("err");
    authToast("Digite sua senha.", "err");
    password?.focus();
    return;
  }

  authBusy = true;
  setAuthButtonLoading(btn, true, "Entrando...");
  showAuthLoading("Entrando...", "Verificando sua conta");

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: emailValue,
      password: passwordValue
    });

    if (error) throw error;
    if (!data?.session) throw new Error("Não foi possível iniciar sua sessão.");

    sessionStorage.removeItem("remote_logout_notice_shown");
    authToast("Login realizado com sucesso! 🎉");
  } catch (error) {
    console.error("Erro no login:", error);
    const code = error?.code || "";
    let message = "E-mail ou senha incorretos.";

    if (code === "email_not_confirmed") {
      message = "Confirme seu e-mail antes de entrar.";
    } else if (error?.message?.toLowerCase().includes("too many requests")) {
      message = "Muitas tentativas. Aguarde alguns instantes e tente novamente.";
    }

    authToast(message, "err");
    hideAuthLoading();
  } finally {
    authBusy = false;
    setAuthButtonLoading(btn, false, "Entrar");
  }
}

async function doRegister() {
  if (authBusy) return;

  const name = document.getElementById("regName");
  const surname = document.getElementById("regSurname");
  const email = document.getElementById("regEmail");
  const phone = document.getElementById("regPhone");
  const password = document.getElementById("regPassword");
  const age = document.getElementById("acceptAge");
  const terms = document.getElementById("acceptTerms");
  const btn = document.getElementById("btnReg");

  const nameValue = name?.value.trim() || "";
  const surnameValue = surname?.value.trim() || "";
  const emailValue = email?.value.trim() || "";
  const phoneValue = phone?.value.replace(/\D/g, "") || "";
  const passwordValue = password?.value || "";

  [name, email, phone, password].forEach(el => el?.classList.remove("err"));

  if (!nameValue) {
    name?.classList.add("err");
    authToast("Digite seu nome.", "err");
    name?.focus();
    return;
  }

  if (!validateEmail(emailValue)) {
    email?.classList.add("err");
    authToast("Digite um e-mail válido.", "err");
    email?.focus();
    return;
  }

  if (phoneValue && phoneValue.length < 10) {
    phone?.classList.add("err");
    authToast("Digite um telefone válido ou deixe o campo em branco.", "err");
    phone?.focus();
    return;
  }

  if (passwordValue.length < 8) {
    password?.classList.add("err");
    authToast("A senha precisa ter pelo menos 8 caracteres.", "err");
    password?.focus();
    return;
  }

  if (age && !age.checked) {
    authToast("Você precisa confirmar que tem 18 anos ou mais.", "err");
    return;
  }

  if (terms && !terms.checked) {
    authToast("Aceite os Termos de Uso e a Política de Privacidade para continuar.", "err");
    return;
  }

  authBusy = true;
  const fullName = `${nameValue} ${surnameValue}`.trim();
  setAuthButtonLoading(btn, true, "Criando conta...");
  showAuthLoading("Criando conta...", "Preparando seu aCloud");

  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email: emailValue,
      password: passwordValue,
      options: {
        data: {
          full_name: fullName,
          name: nameValue,
          surname: surnameValue,
          phone: phoneValue || null
        }
      }
    });

    if (error) throw error;

    sessionStorage.removeItem("remote_logout_notice_shown");

    if (data?.session) {
      authToast("Conta criada com sucesso! 🎉");
      return;
    }

    hideAuthLoading();
    authToast("Conta criada! Verifique seu e-mail para confirmar o cadastro. ✉️");
    setAuthMode(false);

    const loginEmail = document.getElementById("email");
    if (loginEmail) loginEmail.value = emailValue;
  } catch (error) {
    console.error("Erro ao criar conta:", error);
    hideAuthLoading();

    let message = error?.message || "Não foi possível criar sua conta.";
    const lower = message.toLowerCase();
    if (lower.includes("already registered") || lower.includes("already exists") || error?.code === "user_already_exists") {
      message = "Esse e-mail já está cadastrado. Faça login ou use outro e-mail.";
    }

    authToast(message, "err");
  } finally {
    authBusy = false;
    setAuthButtonLoading(btn, false, "Criar conta");
  }
}

async function sendForgot() {
  const email = document.getElementById("email");
  const value = email?.value.trim() || "";

  if (!validateEmail(value)) {
    email?.classList.add("err");
    authToast("Digite seu e-mail para receber o link de recuperação.", "err");
    email?.focus();
    return;
  }

  showAuthLoading("Recuperação de senha", "Enviando o link");
  try {
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await supabaseClient.auth.resetPasswordForEmail(value, { redirectTo });
    if (error) throw error;
    hideAuthLoading();
    authToast("Link de recuperação enviado para seu e-mail. ✉️");
  } catch (error) {
    console.error("Erro ao recuperar senha:", error);
    hideAuthLoading();
    authToast("Não foi possível enviar o link de recuperação.", "err");
  }
}

async function socialLogin(provider) {
  if (authBusy) return;
  authBusy = true;

  const label = provider === "google" ? "Google" : provider === "facebook" ? "Facebook" : provider;
  showAuthLoading("Redirecionando...", `Abrindo o login com ${label}`);

  try {
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        queryParams: provider === "google" ? { prompt: "select_account" } : undefined
      }
    });
    if (error) throw error;
  } catch (error) {
    console.error(`Erro no login ${provider}:`, error);
    hideAuthLoading();
    authToast(`Não foi possível conectar com o ${label}. Verifique se o provedor está configurado no Supabase.`, "err");
    authBusy = false;
  }
}

function startGoogleLogin() {
  return socialLogin("google");
}

function getDeviceInfo() {
  const ua = navigator.userAgent;
  let browser = "Desconhecido";
  let os = "Desconhecido";

  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) browser = "Opera";
  else if (/SamsungBrowser/i.test(ua)) browser = "Samsung Internet";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Safari\//i.test(ua) && !/Chrome|Chromium/i.test(ua)) browser = "Safari";

  if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/Macintosh|Mac OS X/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  return { browser, os };
}

async function registerNewSession(userId) {
  if (!userId) return;

  try {
    let localSessionId = localStorage.getItem("local_session_id");

    if (localSessionId) {
      const { data: existingSession, error } = await supabaseClient
        .from("user_sessions")
        .select("id")
        .eq("id", localSessionId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error || !existingSession) {
        localStorage.removeItem("local_session_id");
        localSessionId = null;
      }
    }

    const { browser, os } = getDeviceInfo();
    let ip = "Desconhecido";

    try {
      const response = await fetch("https://api.ipify.org?format=json", { cache: "no-store" });
      if (response.ok) ip = (await response.json()).ip || ip;
    } catch {}

    if (localSessionId) {
      const { error } = await supabaseClient
        .from("user_sessions")
        .update({ browser, os, ip_address: ip, last_seen_at: new Date().toISOString() })
        .eq("id", localSessionId)
        .eq("user_id", userId);
      if (error) console.error("Erro ao atualizar sessão:", error);
      return;
    }

    const { data, error } = await supabaseClient
      .from("user_sessions")
      .insert([{
        user_id: userId,
        browser,
        os,
        ip_address: ip,
        last_seen_at: new Date().toISOString()
      }])
      .select("id")
      .single();

    if (error) {
      console.error("Erro ao salvar sessão:", error.message);
      return;
    }

    if (data?.id) localStorage.setItem("local_session_id", data.id);
  } catch (error) {
    console.error("Erro ao registrar sessão:", error);
  }
}

function createPausedAccountModal() {
  if (document.getElementById("pausedAccountOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "pausedAccountOverlay";
  overlay.className = "paused-account-overlay";
  overlay.innerHTML = `
    <div class="paused-account-modal">
      <div class="paused-account-icon"><i class="fa-solid fa-pause"></i></div>
      <h3>Conta pausada</h3>
      <p>Sua conta atualmente está desativada. Deseja reativá-la agora para continuar acessando?</p>
      <div class="paused-account-actions">
        <button type="button" class="paused-account-btn secondary" id="btnKeepPaused">Manter desativada</button>
        <button type="button" class="paused-account-btn primary" id="btnReactivateAccount">Reativar conta</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById("btnKeepPaused")?.addEventListener("click", keepAccountPaused);
  document.getElementById("btnReactivateAccount")?.addEventListener("click", reactivateAccount);
}

function showPausedAccountModal() {
  createPausedAccountModal();
  const overlay = document.getElementById("pausedAccountOverlay");
  if (!overlay) return Promise.resolve(false);

  pausedAccountModalOpen = true;
  overlay.classList.add("active");

  return new Promise(resolve => {
    overlay._resolveDecision = resolve;
  });
}

function closePausedAccountModal() {
  const overlay = document.getElementById("pausedAccountOverlay");
  if (!overlay) return;
  overlay.classList.remove("active");
  pausedAccountModalOpen = false;
}

async function keepAccountPaused() {
  const overlay = document.getElementById("pausedAccountOverlay");
  const resolve = overlay?._resolveDecision;
  closePausedAccountModal();
  await supabaseClient.auth.signOut({ scope: "local" });
  if (resolve) {
    overlay._resolveDecision = null;
    resolve(false);
  }
}

async function reactivateAccount() {
  if (pausedAccountChecking) return;
  pausedAccountChecking = true;

  const btn = document.getElementById("btnReactivateAccount");
  const otherBtn = document.getElementById("btnKeepPaused");
  setAuthButtonLoading(btn, true, "Reativando...");
  if (otherBtn) otherBtn.disabled = true;

  try {
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError || !session?.user?.id) throw new Error("Sua sessão expirou. Faça login novamente.");

    const { error } = await supabaseClient
      .from("profiles")
      .update({ account_status: "active", updated_at: new Date().toISOString() })
      .eq("id", session.user.id);

    if (error) throw error;

    const overlay = document.getElementById("pausedAccountOverlay");
    const resolve = overlay?._resolveDecision;
    closePausedAccountModal();

    if (resolve) {
      overlay._resolveDecision = null;
      resolve(true);
    }

    authToast("Conta reativada com sucesso! 🎉");
  } catch (error) {
    console.error("Erro ao reativar conta:", error);
    authToast("Não foi possível reativar sua conta.", "err");
    setAuthButtonLoading(btn, false, "Reativar conta");
    if (otherBtn) otherBtn.disabled = false;
  } finally {
    pausedAccountChecking = false;
  }
}

async function checkPausedAccount(user) {
  if (!user?.id) return false;

  try {
    const { data: profile, error } = await supabaseClient
      .from("profiles")
      .select("account_status")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Erro ao verificar status da conta:", error);
      return true;
    }

    if ((profile?.account_status || "active") !== "paused") return true;

    const shouldReactivate = await showPausedAccountModal();
    return !!shouldReactivate;
  } catch (error) {
    console.error("Erro ao verificar conta pausada:", error);
    authToast("Não foi possível verificar o status da sua conta.", "err");
    return false;
  }
}

function togglePwd(id, button) {
  const input = document.getElementById(id);
  if (!input) return;
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  if (button) button.textContent = show ? "🙈" : "👁";
}

function maskPhone(input) {
  let value = String(input?.value || "").replace(/\D/g, "").slice(0, 11);
  if (value.length > 6) value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
  else if (value.length > 2) value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
  else if (value.length > 0) value = `(${value.slice(0, 2)}`;
  if (input) input.value = value;
}

function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

window.doLogin = doLogin;
window.doRegister = doRegister;
window.sendForgot = sendForgot;
window.socialLogin = socialLogin;
window.startGoogleLogin = startGoogleLogin;
window.maskPhone = maskPhone;
window.checkPausedAccount = checkPausedAccount;
window.registerNewSession = registerNewSession;

(function bindAuthEvents() {
  const run = () => {
    document.getElementById("loginForm")?.addEventListener("submit", event => {
      event.preventDefault();
      doLogin();
    });

    document.getElementById("registerForm")?.addEventListener("submit", event => {
      event.preventDefault();
      doRegister();
    });

    document.getElementById("createAccountBtn")?.addEventListener("click", () => setAuthMode(true));
    document.getElementById("backToLoginBtn")?.addEventListener("click", () => setAuthMode(false));
    document.getElementById("forgotPasswordBtn")?.addEventListener("click", sendForgot);
    document.getElementById("googleBtn")?.addEventListener("click", startGoogleLogin);
    document.getElementById("facebookBtn")?.addEventListener("click", () => socialLogin("facebook"));
    document.getElementById("regPhone")?.addEventListener("input", event => maskPhone(event.target));

    document.getElementById("password")?.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        document.getElementById("loginForm")?.requestSubmit();
      }
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true });
  else run();
})();
