---
name: Som de notificações Android
description: Decisão de usar som padrão e substituir o canal ao mudar sua configuração de áudio.
---

Prefira o som padrão do Android para os avisos de manutenção. Ao mudar o padrão sonoro, crie um novo identificador de canal e mantenha consistência entre o aplicativo, o manifesto e o envio FCM; preserve o canal anterior.

**Why:** dois aparelhos receberam os eventos reais de criação e atualização, mas sem som com o canal de áudio personalizado, embora o recurso WAV fosse válido. O usuário também relatou ausência de som após reinstalar a versão com um canal novo e som padrão. Portanto, trocar o canal não deve ser tratado como solução comprovada. O Android mantém a configuração de áudio de canais já criados; alterar somente o payload do Firebase não substitui essa configuração.

**How to apply:** não trate HTTP 200 do FCM como comprovação de som ou recebimento físico. Verifique também volume, modo sonoro e configurações do canal. O plugin Capacitor utilizado aceita nomes de som com extensão; não atribua o problema à extensão sem conferir sua implementação.

## Categorias ocultas na Samsung

Na One UI 6.1, a Samsung desativa por padrão a exibição do gerenciamento de categorias. Não encontrar a categoria nas configurações não comprova que o aplicativo deixou de criar o canal.

**Why:** a documentação oficial da Samsung descreve essa mudança; os testes físicos encontraram dificuldade para localizar as opções de som em celulares Galaxy. Após orientar os menus e a seleção de um toque, o usuário confirmou o funcionamento da configuração e depois dos avisos reais de criação e aceite, em segundo plano e fechado, e de peça com o setor fechado. Som, vibração e toque abrindo o chamado correto foram confirmados. Não atribua esse resultado apenas à troca de canal, sem considerar a configuração do aparelho.

**How to apply:** quando a opção existir, habilite **Configurações → Notificações → Configurações avançadas → Gerenciar categorias de notificações para cada aplicativo**. Depois abra **Aplicativos → Sistema de Manutenção → Notificações → Categorias de notificações** e toque no nome da categoria, não somente no interruptor. Em versões anteriores, o primeiro controle pode não existir; use diretamente as categorias do aplicativo. Mostrar o menu não garante corrigir o áudio: ainda é preciso conferir Alerta, Som, modo sonoro e volume.

Fonte: https://news.samsung.com/br/personalize-suas-notificacoes-com-a-atualizacao-one-ui-6-1-da-samsung
