# Web, Android e Windows

O mesmo aplicativo e a mesma autenticação/banco Supabase são usados nas três plataformas. O código do navegador continua sendo a aplicação principal; Capacitor o empacota para Android e Electron o executa como programa Windows.

## Supabase: configuração única antes de ativar convites e FCM

1. No SQL Editor do projeto Supabase, execute `supabase/native_push_devices.sql`. Execute também `supabase/push_subscriptions.sql` caso Web Push ainda não tenha essa tabela.
2. Implante as funções `send-push` e `admin-create-user` com a Supabase CLI:

   ```sh
   supabase functions deploy send-push --use-api --no-verify-jwt --project-ref aijkbluzpmffmnflhjyv
   supabase functions deploy admin-create-user --use-api --no-verify-jwt --project-ref aijkbluzpmffmnflhjyv
   ```

   As duas funções validam a sessão no servidor com `auth.getUser` e verificam o perfil e as permissões. Nesta configuração, a autenticação é feita pelas próprias funções, inclusive para JWTs com ES256: `--no-verify-jwt` desliga somente a checagem adicional do gateway, não a autenticação implementada nas funções. Não use esse parâmetro em funções que não validem suas próprias credenciais. `--use-api` permite empacotar pelo servidor sem Docker.

3. Configure os secrets das Edge Functions no Supabase (Dashboard ou fluxo seguro da CLI): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e, opcionalmente, `VAPID_SUBJECT`; para Android, `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL` e `FCM_PRIVATE_KEY`. As chaves privadas ficam somente no Supabase, nunca no navegador nem no APK. A chave pública VAPID do site deve corresponder ao par configurado no Supabase. Se o projeto já usa Web Push, preserve o par VAPID existente em vez de gerar outro.
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

Envios de código para branches `native-builds/**` executam somente a compilação Windows, sem depender do Firebase. Alterações somente em documentos Markdown ou no arquivo do workflow não disparam essa compilação automática; nesses casos, use a execução manual com a plataforma desejada. Use uma branch separada para preparar os pacotes sem alterar a publicação existente do GitHub Pages. O resultado fica nos artifacts da execução do GitHub Actions; uma compilação bem-sucedida não substitui a instalação e os testes em Windows real.

O ambiente Linux usado nesta revisão não possui Android SDK/JDK. A tentativa de finalizar NSIS com Wine também foi bloqueada pelos serviços RPCSS do container. O instalador NSIS e o APK debug foram posteriormente gerados com sucesso pelos runners do GitHub Actions; isso comprova a compilação, não a instalação nem o funcionamento com uma conta real.

### APK Android gerado

- [Baixar o artifact Android no GitHub Actions](https://github.com/marceloconta401/sistema-manutencao/actions/runs/38053436871/artifacts/11670781911). É necessário estar conectado ao GitHub; os artifacts seguem a retenção do repositório.
- Arquivo dentro do ZIP: `Sistema-de-Manutencao-debug.apk`.
- SHA-256 do APK: `f3dcd054684fca656334b4a46b6d2d893b068d6bf3c878b5eb1714fd56a6d0d8`.
- Conferidos no pacote: integridade ZIP, identificador `com.sistemamanutencao.app`, os 15 arquivos dos ícones do launcher idênticos aos originais e o som de notificação nativo idêntico ao original.
- É um APK debug para testes, não uma release para distribuição pública ou Play Store.
- Ainda não validado: instalação e ícone na tela inicial, login real, convites, CRUDs por perfil, histórico, registro FCM e recebimento/clique de Push em aparelho real.

### Backend configurado e verificado

- Aplicados os scripts `native_push_devices.sql` e `push_subscriptions.sql` em uma transação, sem exclusão dos registros existentes.
- As duas tabelas estão com RLS habilitada. A tabela Android tem as quatro políticas de acesso ao próprio dispositivo; a configuração Web Push existente foi preservada.
- Implantadas e ativas as funções `send-push` e `admin-create-user`.
- Preservadas as credenciais VAPID existentes; o digest da chave pública configurada corresponde à chave pública utilizada no aplicativo.
- Verificados nos endpoints reais, para as duas funções: preflight CORS com HTTP 200, método GET rejeitado com HTTP 405, ausência de credenciais e sessão inválida rejeitadas com HTTP 401.
- Esses testes não criaram usuários, não enviaram convites e não geraram notificações. Ainda faltam validação autenticada por perfil e testes em aparelhos reais.
- Configuradas as três credenciais FCM no Supabase a partir da conta de serviço, conferindo que o projeto corresponde ao Firebase do APK e que os digests dos valores configurados correspondem aos fornecidos pelo fluxo seguro.
- A autorização OAuth e a requisição FCM HTTP v1 com o payload Android foram aceitas com HTTP 200. A requisição usou `validate_only: true`: nenhuma mensagem foi entregue, e esse resultado não comprova recebimento em um dispositivo.
- O `google-services.json` usado na compilação identifica o aplicativo, mas não substitui a credencial administrativa FCM. Nenhuma chave privada foi incluída nos pacotes ou no repositório.
- A URL de retorno de convites do Supabase Auth foi preservada. O funcionamento do convite e da definição de senha no endereço configurado ainda precisa ser validado.

### Instalador Windows gerado

- [Baixar o artifact Windows no GitHub Actions](https://github.com/marceloconta401/sistema-manutencao/actions/runs/38049636020/artifacts/11669640222). É necessário estar conectado ao GitHub; os artifacts seguem a retenção do repositório.
- Arquivo dentro do ZIP: `Sistema de Manutenção-1.0.0-x64.exe`.
- SHA-256 do EXE: `1b373704954521cddb0309b15a51a631f777d6dcdd4274bb7308caa3d8fa0d79`.
- Os 15 testes locais e o TypeScript passaram no runner Windows. As seis imagens do ícone oficial foram encontradas nos recursos do instalador gerado.
- Ainda não validado: instalação, ícone do programa instalado, login real, convites, CRUDs, histórico e notificações no Windows. Não há assinatura de código para distribuição pública.

### Configuração Firebase para o APK

Registre no Firebase o aplicativo Android `com.sistemamanutencao.app`. A partir do `google-services.json` baixado, obtenha o base64 no seu computador:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\caminho\google-services.json"))
```

Guarde o resultado como secret `GOOGLE_SERVICES_JSON_BASE64` no GitHub Actions ou no formulário seguro solicitado pelo agente. Não envie o resultado pelo chat. Para configurar esse secret por automação, o token GitHub precisa de permissão de leitura e escrita em **Secrets**, além de **Contents**, **Workflows** e **Actions**. O JSON do aplicativo não substitui a conta de serviço FCM nem os secrets das funções Supabase.

## Verificação

`pnpm --filter @workspace/manutencao-android test` e `typecheck` verificam o código local. A entrega FCM requer teste com um Android instalado, usuário inscrito e o app em primeiro plano, segundo plano e fechado pela lista de recentes. Não confunda esse último estado com **Forçar parada** nas configurações do Android: o sistema impede o recebimento de Push de um aplicativo forçado a parar até ele ser aberto novamente. Convites exigem testar uma conta administradora e confirmar o e-mail recebido. O Windows requer executar o instalador em uma máquina Windows para verificar atalhos, ícone e notificações.

### Roteiro em aparelhos reais — ainda pendente

Use contas autorizadas dos perfis administrador, mecânico e setor. Identifique quaisquer registros criados para teste e não exclua nem altere chamados, usuários ou histórico reais.

- [ ] Android: instalar o APK debug, conferir o ícone na tela inicial, entrar com uma conta mecânica ativa, permitir notificações e confirmar o registro do dispositivo.
- [ ] Windows: instalar o EXE, conferir os ícones do instalador, atalhos e aplicativo, e entrar com uma conta autorizada.
- [ ] Administrador: convidar uma conta de teste, confirmar o recebimento do e-mail, definir a senha pelo link e entrar com a nova senha.
- [ ] Perfis: verificar criação, leitura, edição e exclusão onde permitidas pelas regras existentes; confirmar que operações proibidas são rejeitadas e que o histórico permanece correto.
- [ ] Setor: criar um chamado identificado como teste e conferir a notificação no Android mecânico.
- [ ] Mecânico: aceitar e atualizar o chamado, solicitar uma peça e conferir os avisos aos destinatários previstos.
- [ ] Android: repetir os eventos relevantes com o aplicativo em segundo plano e fechado pela lista de recentes; conferir som, vibração e abertura do chamado ao tocar na notificação.
- [ ] Windows: conferir notificações e abertura do chamado, inclusive com o programa minimizado na bandeja.

Registre o resultado por etapa e eventuais mensagens de erro sem compartilhar senhas, tokens ou conteúdo privado. Compilação, inspeção dos recursos, testes estáticos e validação FCM sem entrega não substituem esse roteiro.
