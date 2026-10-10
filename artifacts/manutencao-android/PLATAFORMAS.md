# Web, Android e Windows

O mesmo aplicativo e a mesma autenticação/banco Supabase são usados nas três plataformas. O código do navegador continua sendo a aplicação principal; Capacitor o empacota para Android e Electron o executa como programa Windows.

## Supabase: configuração única antes de ativar convites e FCM

1. No SQL Editor do projeto Supabase, execute `supabase/native_push_devices.sql`. Execute também `supabase/push_subscriptions.sql` caso Web Push ainda não tenha essa tabela.
2. Implante as funções `send-push` e `admin-create-user` com a Supabase CLI:

   ```sh
   supabase functions deploy send-push
   supabase functions deploy admin-create-user
   ```

3. Configure os secrets das Edge Functions no Supabase (Dashboard ou fluxo seguro da CLI): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e, opcionalmente, `VAPID_SUBJECT`; para Android, `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL` e `FCM_PRIVATE_KEY`. As chaves privadas ficam somente no Supabase, nunca no navegador nem no APK. A chave pública VAPID do site deve corresponder ao par configurado no Supabase.
4. No Firebase, habilite Firebase Cloud Messaging e a API HTTP v1. Registre o aplicativo Android com o identificador `com.sistemamanutencao.app`, baixe o `google-services.json` correspondente e coloque-o em `android/app/google-services.json`. Configure uma conta de serviço com permissão de envio FCM e guarde a chave privada nos secrets do Supabase.
5. Configure no Supabase Auth o envio de convites por e-mail e a URL de redirecionamento usada pelos usuários convidados. A função `admin-create-user` valida o administrador e a organização no servidor; não usa a chave de serviço no cliente.

Tokens nativos são associados ao usuário autenticado e removidos no logout. O Android usa o canal `maintenance_calls_v1`, som do recurso local e vibração. Android permite que a pessoa altere som/vibração do canal nas configurações do aparelho.

## Android

Requisitos: Node.js, pnpm, JDK compatível com a versão do Gradle do projeto, Android SDK e `ANDROID_HOME` ou `ANDROID_SDK_ROOT`. O arquivo `google-services.json` é necessário para o registro e a entrega FCM.

```sh
pnpm --filter @workspace/manutencao-android install
pnpm --filter @workspace/manutencao-android run android:sync
pnpm --filter @workspace/manutencao-android run android:apk
```

O APK de depuração é copiado para `artifacts/manutencao-android/release/Sistema-de-Manutencao-debug.apk`. Ele serve para instalação e teste; publicação na Play Store exige uma chave de assinatura de release, configuração de assinatura local segura e testes em aparelho real. Não distribua um APK debug como release.

## Windows

Requisitos: Node.js e pnpm. Gere o instalador NSIS x64 em uma máquina Windows:

```sh
pnpm --filter @workspace/manutencao-android install
pnpm --filter @workspace/manutencao-android run windows:exe
```

Os arquivos de instalação são gravados em `artifacts/manutencao-android/release/`. O EXE usa o ícone configurado para o programa, atalhos e instalador. Distribuição pública deve ser assinada com certificado de código da organização para reduzir alertas do Windows; nenhuma chave de assinatura deve ser incluída no repositório.

## Compilação automatizada

O workflow manual `.github/workflows/native-builds.yml` permite compilar Windows em um runner Windows e Android em um runner com SDK/JDK, quando o repositório estiver no GitHub. Para Android, configure o secret `GOOGLE_SERVICES_JSON_BASE64` com o arquivo Firebase do aplicativo codificado em base64. Esse arquivo não contém a chave privada da conta de serviço FCM; essa chave continua somente no Supabase.

O APK debug foi compilado neste ambiente após instalar JDK 21 e as ferramentas oficiais Android, com SDK em armazenamento temporário. O arquivo Firebase do aplicativo foi integrado sem entrar no Git. A assinatura APK v2, pacote, nome, recursos de ícone e componentes FCM foram conferidos no binário. Isso não substitui instalação e teste de Push em celular real.

O SDK temporário pode desaparecer ao recriar o ambiente; configure `ANDROID_HOME` para um SDK instalado antes de futuras compilações. A configuração do secret de compilação no GitHub depende de um token com permissão de repositório **Secrets: Read and write**; a tentativa com o token disponível foi negada (HTTP 403), portanto o secret ainda não foi confirmado.

A finalização NSIS com Wine permanece bloqueada pelos serviços RPCSS do container. Use Windows para compilar e validar o instalador.

## Verificação

`pnpm --filter @workspace/manutencao-android test` e `typecheck` verificam o código local. A entrega FCM requer teste com um Android instalado, usuário inscrito e o app em primeiro plano e encerrado. Convites exigem testar uma conta administradora e confirmar o e-mail recebido. O Windows requer executar o instalador em uma máquina Windows para verificar atalhos, ícone e notificações.
