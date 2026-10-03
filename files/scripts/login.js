const SUPABASE_URL = "https://sycnitxcfdctzpwpgxcv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_wH3L4RoNaxchI4RD2u5upA_qly1ocoK";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let userId = null;

// ── GOOGLE SIGN-IN ───────────────────────────────────────────
const GOOGLE_CLIENT_ID = '878360677801-j7amq95cfr0ekqh7bgvg8j42ciu68plm.apps.googleusercontent.com';
let googleCredentialPending = null;
let googleAccountPending = null;
let googleModalResolver = null;

// -------------------------------

let currentNonce = '';
function generateNonce() {
  const array = new Uint8Array(16);
  window.crypto.getRandomValues(array);
  return Array.from(array, c => c.toString(16).padStart(2, '0')).join('');
}

// -------------------------------

let googleReady = false;
let isInitializingGoogle = false;

async function initGoogleIdentity() {
  if (
    typeof google === 'undefined' ||
    !google.accounts ||
    !google.accounts.id
  ) {
    return false;
  }
  if (googleReady) return true;
  if (isInitializingGoogle) return false;
  
  isInitializingGoogle = true;

  try {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
      auto_select: false,
      use_fedcm_for_prompt: true
    });
    
    googleReady = true;
    return true;
  } finally {
    isInitializingGoogle = false;
  }
}

// -------------------------------

const selectWait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
async function startGoogleLogin() {
  const ready = await initGoogleIdentity();
  showLoadingModal('Um Momento...', 'Carregando Login com o Google');
  if (!ready) {
    toast('O login do Google ainda está carregando.', 'err');
    return;
  }

  google.accounts.id.prompt(notification => {
    console.log('Google Prompt Notification:', notification);
    const credentialPickerContainer = document.getElementById('credential_picker_container');
    credentialPickerContainer.style.setProperty("z-index", "850000", "important");
    
    if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
      const reason = notification.getNotDisplayedReason?.() || notification.getSkippedReason?.();
      console.warn('One Tap não exibido pelo motivo:', reason);
      triggerGooglePopupFallback();
    }
  });
  await selectWait(5000);
  hideLoadingModal();
  showLoadingModal('Selecione uma Conta', 'Selecione uma conta Google para continuar');
}

// ---------------------------------------

function triggerGooglePopupFallback() {
  supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + window.location.pathname + window.location.search,
      queryParams: {
        prompt: 'select_account'
      }
    }
  });
}

// -------------------------------

function waitForGoogleIdentity() {
  return new Promise(resolve => {
    if (
      typeof google !== 'undefined' &&
      google.accounts?.id
    ) {
      resolve(initGoogleIdentity());
      return;
    }
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      if (
        typeof google !== 'undefined' &&
        google.accounts?.id
      ) {
        clearInterval(timer);
        resolve(initGoogleIdentity());
        return;
      }
      if (tries >= 100) {
        clearInterval(timer);
        resolve(false);
      }
    }, 100);
  });
}

// ------------------------------------------------

async function handleGoogleCredential(response) {
  if (!response?.credential) {
    toast('Não foi possível obter a conta do Google.', 'err');
    return;
  }
  try {
    hideLoadingModal();
    showLoadingModal('Verificando conta...', 'Estamos verificando sua conta do Google');
    const result = await verifyGoogleAccount(response.credential);
    hideLoadingModal();
    if (!result) return;
    if (result.exists) {
      await loginExistingGoogleAccount(
        response.credential
      );
      return;
    }

    googleCredentialPending = response.credential;
    googleAccountPending = result.account;
    await showGoogleAccountConfirmation(
      result.account
    );

  } catch (error) {
    console.error('Erro no Google Login:', error);
    hideLoadingModal();
    toast(error.message || 'Não foi possível verificar a conta do Google.', 'err');
  }
}

// ------------------------------------------------

async function verifyGoogleAccount(credential) {
  const {
    data,
    error
  } = await supabaseClient.functions.invoke('google-account-check',
    {
      body: {
        credential
      }
    }
  );

  if (error) {
    console.error('Erro ao verificar Google:', error);
    let message = error.message;
    if (error.context) {
      try {
        const body = await error.context.json();
        console.error('Resposta da Edge Function:', body
        );
        message = body?.error || body?.message || message;
      } catch {}

    }
    throw new Error(message);
  }
  if (!data?.success) {
    throw new Error(data?.error || 'Não foi possível verificar a conta.');
  }
  return data;
}

// ----------------------------------------------

function showGoogleAccountConfirmation(account) {
  createGoogleConfirmModal();
  const overlay = document.getElementById('googleConfirmOverlay');
  const avatar = document.getElementById('googleConfirmAvatar');
  const name = document.getElementById('googleConfirmName');
  const surname = document.getElementById('googleConfirmSurname');
  const email = document.getElementById('googleConfirmEmail');
  const phone = document.getElementById('googleConfirmPhone');
  const birth = document.getElementById('googleConfirmBirth');
  const gender = document.getElementById('googleConfirmGender');
  avatar.src = account.picture || '/images/icons/full/user.webp';
  name.value = account.given_name || '';
  surname.value = account.family_name || '';
  email.value = account.email || '';
  phone.value = account.phone_number || '';
  birth.value = '';
  gender.value = '';
  overlay.classList.add('active');
  return new Promise(resolve => {
    googleModalResolver = resolve;
  });
}

// ------------------------------------------------

function createGoogleConfirmModal() {
  if (document.getElementById('googleConfirmOverlay')
  ) {
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = 'googleConfirmOverlay';
  overlay.className = 'google-confirm-overlay';
  overlay.innerHTML = `
    <div class="google-confirm-modal">
      <div class="google-confirm-head">
        <div class="google-confirm-avatar">
          <img
            id="googleConfirmAvatar"
            src="/images/icons/full/user.webp"
            alt="Foto da conta Google"
          >
        </div>
        <h3>
          Confirme sua conta
        </h3>
        <p>
          Verifique os dados da conta Google
          antes de criar sua conta na Ecomme.
        </p>
      </div>
      <div class="google-confirm-grid">
        <div class="google-confirm-field">
          <label>
            Nome
            <span class="google-confirm-required">*</span>
          </label>
          <input
            id="googleConfirmName"
            class="google-confirm-input"
            type="text"
            maxlength="100"
            autocomplete="given-name"
          >
        </div>
        <div class="google-confirm-field">
          <label>
            Sobrenome
          </label>
          <input
            id="googleConfirmSurname"
            class="google-confirm-input"
            type="text"
            maxlength="100"
            autocomplete="family-name"
          >
        </div>
        <div class="google-confirm-field full">
          <label>
            E-mail
          </label>
          <input
            id="googleConfirmEmail"
            class="google-confirm-input"
            type="email"
            readonly
            tabindex="-1"
          >
        </div>
        <div class="google-confirm-field full">
          <label>
            Telefone
          </label>
          <input
            id="googleConfirmPhone"
            class="google-confirm-input"
            type="tel"
            placeholder="(00) 00000-0000"
            maxlength="15"
            oninput="maskPhone(this)"
          >
        </div>
        <div class="google-confirm-field">
          <label>
            Data de nascimento
          </label>
          <input
            id="googleConfirmBirth"
            class="google-confirm-input"
            type="date"
          >

        </div>
        <div class="google-confirm-field">
          <label>
            Gênero
          </label>
          <select
            id="googleConfirmGender"
            class="google-confirm-input"
          >
            <option value="">
              Prefiro não informar
            </option>
            <option value="Masculino">
              Masculino
            </option>
            <option value="Feminino">
              Feminino
            </option>
            <option value="Outro">
              Outro
            </option>
          </select>
        </div>
      </div>
      <div class="google-confirm-actions">
        <button
          type="button"
          class="google-confirm-btn google-confirm-cancel"
          onclick="cancelGoogleAccountCreation()"
        >
          Cancelar
        </button>
        
        <button
          type="button"
          id="googleConfirmContinue"
          class="google-confirm-btn google-confirm-continue"
          onclick="confirmGoogleAccountCreation()"
        >
          Continuar
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

// --------------------------------------

function cancelGoogleAccountCreation() {
  googleCredentialPending = null;
  googleAccountPending = null;
  const overlay = document.getElementById('googleConfirmOverlay');
  if (overlay) {
    overlay.classList.remove('active');
  }
  if (googleModalResolver) {
    googleModalResolver(false);
    googleModalResolver = null;
  }
}

// -----------------------------------------------

async function confirmGoogleAccountCreation() {
  if (!googleCredentialPending) {
    toast('A sessão do Google expirou. Tente novamente.', 'err'
    );
    return;
  }
  const nameInput = document.getElementById('googleConfirmName');
  const surnameInput = document.getElementById('googleConfirmSurname');
  const phoneInput = document.getElementById('googleConfirmPhone');
  const birthInput = document.getElementById('googleConfirmBirth');
  const genderInput = document.getElementById('googleConfirmGender');
  const btn = document.getElementById('googleConfirmContinue');
  const name = nameInput.value.trim();
  const surname = surnameInput.value.trim();
  const phone = phoneInput.value.replace(/\D/g, '');
  const birthDate = birthInput.value || null;
  const gender = genderInput.value || null;
  if (!name) {
    nameInput.focus();
    toast('Digite seu nome para continuar.', 'err');
    return;
  }

  btn.classList.add('loading');
  btn.textContent = 'Criando conta...';

  try {
    const { data, error } = await supabaseClient.auth.signInWithIdToken({
      provider: 'google', 
      token: googleCredentialPending
    });
    
    if (error) {
      throw error;
    }
    if (!data?.user) {
      throw new Error('Não foi possível criar sua conta.');
    }
    const fullName = `${name} ${surname}`.trim();

    console.log('Dados que serão salvos no perfil:', {
      userId: data.user.id,
      full_name: fullName,
      phone: phone || null,
      birth_date: birthDate,
      gender: gender
    });
    
    const { error: profileError } =
      await supabaseClient
        .from('profiles')
        .update({
          full_name: fullName,
          phone: phone || null,
          birth_date: birthDate,
          gender: gender
        })
        .eq('id', data.user.id);

    if (profileError) {
      console.error('Erro real ao salvar profiles:', profileError);
      throw new Error(`A conta foi criada, mas os dados não foram salvos: ${profileError.message}`);
    }
    
    googleCredentialPending = null;
    googleAccountPending = null;

    const overlay = document.getElementById('googleConfirmOverlay');
    if (overlay) {
      overlay.classList.remove('active');
    }

    if (googleModalResolver) {
      googleModalResolver(true);
      googleModalResolver = null;
    }
    
    sessionStorage.removeItem('remote_logout_notice_shown');
    toast('Conta criada com sucesso! 🎉');
    setTimeout(() => {
      window.location.href = getTargetUrl();
    }, 1000);
  } catch (error) {
    console.error('Erro ao criar conta Google:', error);
    toast(error.message || 'Não foi possível criar a conta.', 'err');
    btn.classList.remove('loading');
    btn.textContent = 'Continuar';
  }
}

// ---------------------------------------

async function loginExistingGoogleAccount(credential, account) {
  hideLoadingModal();
  showLoadingModal('Entrando...', 'Verificando sua conta');
  try {
    const { data, error } = await supabaseClient.auth.signInWithIdToken({
      provider: 'google', 
      token: credential
    });
    
    if (!error && data?.session) return;
    console.error('Erro no signInWithIdToken:', error);
    if (
      error &&
      (
        error.code === 'user_already_exists' ||
        error.code === 'email_exists' ||
        error.message ?.toLowerCase().includes('already exists')
      )
    ) {
      hideLoadingModal();
      const {data: oauthData, error: oauthError} =
        await supabaseClient.auth
          .signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo: window.location.origin + window.location.pathname + window.location.search,
              queryParams: {login_hint: account?.email || ''}
            }
          });

      if (oauthError) throw oauthError;
      return;
    }
    throw error;
  } catch (error) {
    hideLoadingModal();
    console.error('Erro no login Google:', error);

    let message = error?.message || 'Não foi possível entrar com o Google.';
    if (error?.code === 'identity_already_exists') {
      message = 'Essa conta Google já está vinculada a outro usuário Ecomme.';
    }
    else if (error?.code === 'email_not_confirmed') {
      message = 'O e-mail dessa conta ainda não foi confirmado.';
    }
    else if (error?.code === 'user_already_exists') {
      message = 'Já existe uma conta Ecomme com esse e-mail.';
    }
    toast(message, 'err');
  }
}

// ── SOCIAL LOGIN (GOOGLE & FACEBOOK - SUPABASE) ──────────
async function socialLogin(provider) {
  //toast(`Redirecionando para o ${provider}...`);
  showLoadingModal('Redirecionando...', `Carregando o login com o ${provider}`);
  const { data, error } = await supabaseClient.auth.signInWithOAuth({
    provider: provider,
    options: {
      redirectTo: window.location.origin + window.location.pathname + window.location.search 
    }
  });
  if (error) {
    console.error(error);
    requestAnimationFrame(() => {setTimeout(() => {hideLoadingModal();}, 180);});
    toast(`Erro ao conectar com ${provider}.`, 'err');
  }
}

// ── PAUSED ACCOUNT ─────────────────────────────────────────────
let pausedAccountModalOpen = false;
let pausedAccountChecking = false;

function createPausedAccountModal() {
  if (document.getElementById('pausedAccountOverlay')) {
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = 'pausedAccountOverlay';
  overlay.className = 'paused-account-overlay';
  overlay.innerHTML = `
    <div class="paused-account-modal">
      <div class="paused-account-icon">
        <i class="fa-solid fa-pause"></i>
      </div>
      <h3>Conta pausada</h3>
      <p>
        Sua conta atualmente está desativada.
        Deseja reativá-la agora para continuar
        acessando sua conta?
      </p>
      <div class="paused-account-actions">

        <button
          type="button"
          class="paused-account-btn secondary"
          id="btnKeepPaused"
          onclick="keepAccountPaused()"
        >
          Manter desativada
        </button>

        <button
          type="button"
          class="paused-account-btn primary"
          id="btnReactivateAccount"
          onclick="reactivateAccount()"
        >
          Reativar conta
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function showPausedAccountModal() {
  createPausedAccountModal();
  const overlay = document.getElementById('pausedAccountOverlay');
  if (!overlay) {
    return Promise.resolve(false);
  }
  pausedAccountModalOpen = true;
  overlay.classList.add('active');
  return new Promise(resolve => {
    overlay._resolveDecision = resolve;
  });
}

function closePausedAccountModal() {
  const overlay = document.getElementById('pausedAccountOverlay');
  if (!overlay) return;
  overlay.classList.remove('active');
  pausedAccountModalOpen = false;
}

async function keepAccountPaused() {
  const overlay = document.getElementById('pausedAccountOverlay');
  const resolve = overlay?._resolveDecision;
  closePausedAccountModal();
  if (resolve) {
    overlay._resolveDecision = null;
    resolve(false);
  }
}

async function reactivateAccount() {
  if (pausedAccountChecking) return;
  pausedAccountChecking = true;
  const btn = document.getElementById('btnReactivateAccount');
  const otherBtn = document.getElementById('btnKeepPaused');

  if (btn) {
    btn.classList.add('loading');
    btn.textContent = 'Reativando...';
  }
  if (otherBtn) {
    otherBtn.disabled = true;
  }

  try {
    const {
      data: { session },
      error: sessionError
    } = await supabaseClient.auth.getSession();
    if (sessionError || !session?.user?.id) {
      throw new Error( 'Sua sessão expirou. Faça login novamente.');
    }

    const { error } =
      await supabaseClient
        .from('profiles')
        .update({
          account_status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', session.user.id);

    if (error) {
      console.error('Erro ao reativar conta:', error
      );
      throw new Error('Não foi possível reativar sua conta.'
      );
    }

    const overlay = document.getElementById('pausedAccountOverlay');
    const resolve = overlay?._resolveDecision;
    closePausedAccountModal();
    if (resolve) {
      overlay._resolveDecision = null;
      resolve(true);
    }
  } catch (error) {
    console.error('Erro ao reativar conta:', error);
    toast(error.message || 'Não foi possível reativar sua conta.', 'err');

    if (btn) {
      btn.classList.remove('loading');
      btn.textContent = 'Reativar conta';
    }
    if (otherBtn) {
      otherBtn.disabled = false;
    }
    pausedAccountChecking = false;
    return false;
  }
}


async function checkPausedAccount(user) {
  if (!user?.id) {
    return false;
  }
  try {
    const {
      data: profile,
      error
    } = await supabaseClient
      .from('profiles')
      .select('account_status')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao verificar status da conta:', error);
      return true;
    }
    const status = profile?.account_status || 'active';
    if (status !== 'paused') {
      return true;
    }

    const shouldReactivate = await showPausedAccountModal();
    if (!shouldReactivate) {
      await supabaseClient.auth.signOut({
        scope: 'local'
      });
      return false;
    }
    return true;
  } catch (error) {
    console.error('Erro ao verificar conta pausada:', error);
    toast('Não foi possível verificar o status da sua conta.', 'err');
    return false;
  }
}

// ── LOGIN E-MAIL & PWD (SUPABASE) ────────────────
async function doLogin() {
  let valid = true;
  const email = document.getElementById('loginEmail');
  const pwd = document.getElementById('loginPwd');
  if (!validateEmail(email.value.trim())) {
    showFieldErr(email, 'loginEmailErr');
    valid = false;
  }

  if (!pwd.value) {
    showFieldErr(pwd, 'loginPwdErr');
    valid = false;
  }
  if (!valid) {
    toast('Preencha os campos obrigatórios', 'err');
    return;
  }
  const btn = document.getElementById('btnLogin');
  btn.classList.add('loading');
  const {
    data,
    error
  } = await supabaseClient.auth.signInWithPassword({
    email: email.value.trim(),
    password: pwd.value
  });

  btn.classList.remove('loading');
  if (error) {
    console.error('Erro no login:', error);
    toast('E-mail ou senha incorretos.', 'err');
    return;
  }
}

// ── REGISTER E-MAIL & PWD (SUPABASE) ─────────────
async function doRegister(){
  let valid = true;
  const name  = document.getElementById('regName');
  const sob   = document.getElementById('regSob');
  const email = document.getElementById('regEmail');
  const phone = document.getElementById('regPhone');
  const pwd   = document.getElementById('regPwd');
  
  const termsAge = document.getElementById('acceptAge');
  const termsDoc = document.getElementById('acceptTerms');
  
  if(!name.value.trim()){ showFieldErr(name,'regNameErr'); valid = false; }
  if(!validateEmail(email.value.trim())){ showFieldErr(email,'regEmailErr'); valid = false; }
  
  const phoneValue = phone.value.replace(/\D/g, '');
  if(phoneValue.length < 11){ showFieldErr(phone, 'regPhoneErr'); valid = false; }
  if(pwd.value.length < 8){ showFieldErr(pwd,'regPwdErr'); valid = false; }
  
  if(termsAge && !termsAge.checked){ toast('Você precisa ter 18 anos ou mais','err'); return; }
  if(termsDoc && !termsDoc.checked){ toast('Aceite os termos para continuar','err'); return; }

  const captchaToken = hcaptcha.getResponse();
  if (!captchaToken) {
    toast('Por favor, confirme que você não é um robô 🤖', 'err');
    return;
  }
  const btn = document.getElementById('btnReg');
  btn.classList.add('loading');
  const fullName = `${name.value.trim()} ${sob.value.trim()}`.trim(); 
  const { data, error } = await supabaseClient.auth.signUp({
    email: email.value.trim(),
    password: pwd.value,
    options: {
      captchaToken: captchaToken,
      data: {
        full_name: fullName,
        phone: phoneValue
      }
    }
  });
  hcaptcha.reset();
  btn.classList.remove('loading');

  if(!valid) return;
  
  if (error) {
    console.error(error);
    toast(error.message, 'err');
  } else {
    sessionStorage.removeItem('remote_logout_notice_shown');
    toast('Conta criada! Verifique o seu e-mail para confirmar o cadastro. 🚀');
  }
}

// ── LOCK VARIABLE ──
let redirectionInProgress = false;

// ── DEVICE REGISTER ──────────────────────
function getDeviceInfo() {
  const ua = navigator.userAgent;
  let browser = "Desconhecido";
  let os = "Desconhecido";

  // Browser
  if (/Edg\//i.test(ua)) {
    browser = "Edge";
  } else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) {
    browser = "Opera";
  } else if (/Firefox\//i.test(ua)) {
    browser = "Firefox";
  } else if (/SamsungBrowser/i.test(ua)) {
    browser = "Samsung Internet";
  } else if (/Chrome\//i.test(ua)) {
    browser = "Chrome";
  } else if (/Safari\//i.test(ua) && !/Chrome|Chromium/i.test(ua)) {
    browser = "Safari";
  }

  // OS
  if (/iPhone|iPad|iPod/i.test(ua)) {
    os = "iOS";
  } else if (/Android/i.test(ua)) {
    os = "Android";
  } else if (/Windows/i.test(ua)) {
    os = "Windows";
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    os = "macOS";
  } else if (/Linux/i.test(ua)) {
    os = "Linux";
  }

  return { browser, os };
}

async function registerNewSession(userId) {
  if (!userId) return;

  let localSessionId = localStorage.getItem('local_session_id');
  if (localSessionId) {
    const { data: existingSession, error } =
      await supabaseClient
        .from('user_sessions')
        .select('id')
        .eq('id', localSessionId)
        .eq('user_id', userId)
        .maybeSingle();
    
    if (!existingSession || error) {
      localStorage.removeItem('local_session_id');
      localSessionId = null;
    }
  }
  const { browser, os } = getDeviceInfo();
  let ip = "Desconhecido";
  try {
    const res = await fetch(
      'https://api.ipify.org?format=json'
    );
    if (res.ok) {
      const data = await res.json();
      ip = data.ip || "Desconhecido";
    }
  } catch (e) {
    console.warn(
      "Não foi possível capturar o IP."
    );
  }
  if (localSessionId) {
    const { error } = await supabaseClient
      .from('user_sessions')
      .update({
        browser,
        os,
        ip_address: ip,
        last_seen_at: new Date().toISOString()
      })
      .eq('id', localSessionId)
      .eq('user_id', userId);
    
    if (error) {
      console.error(
        'Erro ao atualizar sessão:',
        error
      );
    }
    return;
  }
  const { data, error } =
    await supabaseClient
      .from('user_sessions')
      .insert([{
        user_id: userId,
        browser,
        os,
        ip_address: ip,
        last_seen_at: new Date().toISOString()
      }])
      .select('id')
      .single();
  
  if (error) {
    console.error(
      '🚨 ERRO AO SALVAR SESSÃO:',
      error.message
    );
    return;
  }
  if (data?.id) {
    localStorage.setItem(
      'local_session_id',
      data.id
    );
  }
}

// ── ACTIVE SESSION & URL CLEAR ────────────
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (!session || redirectionInProgress) {
      return;
    }
    redirectionInProgress = true;
    try {
      const canContinue = await checkPausedAccount(session.user);
      if (!canContinue) {
        redirectionInProgress = false;
        return;
      }
      sessionStorage.removeItem('remote_logout_notice_shown');
      await registerNewSession(session.user.id);
      const finalDestination = getTargetUrl();
      if (
        window.location.search || window.location.hash
      ) {
        window.history.replaceState(
          {},
          document.title, window.location.pathname
        );
      }

      localStorage.removeItem('ecomme_redirect_url');
      if (
        document.getElementById('formLogin')
      ) {
        requestAnimationFrame(() => {
          setTimeout(() => {
            hideLoadingModal();
          }, 180);
        });
        toast('Sessão ativa! Redirecionando... 🎉');
        setTimeout(() => {
          window.location.href = finalDestination;
        }, 1200);
      }
    } catch (error) {
      console.error('Erro após autenticação:', error);
      redirectionInProgress = false;
      toast('Não foi possível concluir o login.', 'err');
    }
  }
);

// ── FORGOT PASSWORD ────────────────────────────────────────
function toggleForgot(show){
  document.getElementById('forgotPanel').classList.toggle('on', show);
  document.getElementById('loginMain').style.display = show ? 'none' : 'block';
}

function sendForgot(){
  const v = document.getElementById('forgotEmail').value.trim();
  if(!v || !v.includes('@')){ toast('Digite um e-mail válido','err'); return; }
  
  simulateLoad('btnLogin', () => {
    toast('Link enviado para ' + v + ' ✉️');
    toggleForgot(false);
  });
}


// ── TOGGLE PASSWORD ────────────────────────────────────────
function togglePwd(id, btn){
  const inp = document.getElementById(id);
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.textContent = show ? '🙈' : '👁';
}


// ── FIELD VALIDATION ───────────────────────────────────────
function showFieldErr(inp, msgId){
  inp.classList.add('err');
  const el = document.getElementById(msgId);
  if(el){ el.style.display = 'block'; }
}
function clearFieldErr(inp){
  inp.classList.remove('err');
  const siblings = inp.parentElement.querySelectorAll('.field-err');
  siblings.forEach(s => s.style.display = 'none');
  if(inp.value.length > 0) inp.classList.add('ok'); else inp.classList.remove('ok');
}
function validateEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }


// ── MASKS ──────────────────────────────────────────────────
function maskCPF(inp){
  let v = inp.value.replace(/\D/g,'').slice(0,11);
  if(v.length > 9) v = v.slice(0,3)+'.'+v.slice(3,6)+'.'+v.slice(6,9)+'-'+v.slice(9);
  else if(v.length > 6) v = v.slice(0,3)+'.'+v.slice(3,6)+'.'+v.slice(6);
  else if(v.length > 3) v = v.slice(0,3)+'.'+v.slice(3);
  inp.value = v;
}
function maskPhone(inp){
  let v = inp.value.replace(/\D/g,'').slice(0,11);
  if(v.length > 6) v = '('+v.slice(0,2)+') '+v.slice(2,7)+'-'+v.slice(7);
  else if(v.length > 2) v = '('+v.slice(0,2)+') '+v.slice(2);
  inp.value = v;
}


// ── PASSWORD STRENGTH ──────────────────────────────────────
function checkPwd(v){
  const wrap = document.getElementById('pwdStrength');
  wrap.style.display = v ? 'block' : 'none';
  const r1 = v.length >= 8;
  const r2 = /[A-Z]/.test(v);
  const r3 = /[0-9]/.test(v);
  const r4 = /[^A-Za-z0-9]/.test(v);
  document.getElementById('r1').classList.toggle('ok', r1);
  document.getElementById('r2').classList.toggle('ok', r2);
  document.getElementById('r3').classList.toggle('ok', r3);
  document.getElementById('r4').classList.toggle('ok', r4);
  const score = [r1,r2,r3,r4].filter(Boolean).length;
  const bars = ['pb1','pb2','pb3','pb4'];
  const cls = ['s1','s2','s3','s4'];
  const lbls = ['Muito fraca','Fraca','Moderada','Forte'];
  bars.forEach((id,i) => {
    const b = document.getElementById(id);
    b.className = 'pwd-bar ' + (i < score ? cls[score-1] : '');
  });
  const lbl = document.getElementById('pwdLbl');
  lbl.textContent = score ? lbls[score-1] : 'Muito fraca';
  lbl.className = 'pwd-label ' + (score ? cls[score-1] : 's1');
}


// ── SIMULATE LOADING (Mantido para recuperar senha) ────────
function simulateLoad(btnId, cb, delay=1400){
  const btn = document.getElementById(btnId);
  if (btn) btn.classList.add('loading');
  setTimeout(() => { if(btn) btn.classList.remove('loading'); cb(); }, delay);
}


// ── TOAST ──────────────────────────────────────────────────
function toast(msg, type='ok'){
  const t  = document.getElementById('toast1');
  const ic = document.getElementById('toastIco');
  const tx = document.getElementById('toastMsg');
  if(!t || !ic || !tx) return;
  tx.textContent = msg;
  ic.className = 'toast-ico ' + type;
  ic.textContent = type === 'ok' ? '✓' : '!';
  t.classList.add('on');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('on'), 10000);
}

// ── KEYBOARD SUBMIT ────────────────────────────────────────
document.addEventListener('keydown', e => {
  if(e.key !== 'Enter') return;
  const active = document.activeElement;
  if(document.getElementById('formLogin').classList.contains('hidden')) doRegister();
  else doLogin();
});

// ── REDIRECT FUNCTION ──
/*function getTargetUrl() {
  const storedRedirect = localStorage.getItem('ecomme_redirect_url');
  if (storedRedirect) {
    return storedRedirect;
  }
  const urlParams = new URLSearchParams(window.location.search);
  const urlRedirect = urlParams.get('redirect');
  if (urlRedirect) {
    return urlRedirect;
  }
  return '/';
}*/
