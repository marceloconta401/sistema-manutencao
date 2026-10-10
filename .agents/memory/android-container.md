---
name: Compilação Android no container
description: Possibilidade confirmada de gerar APK local com ferramentas oficiais apesar da ausência inicial de SDK.
---

Não trate a ausência inicial de Android SDK/JDK como impedimento definitivo para gerar APK neste container.

**Why:** JDK 21 instalado por Nix e Android command-line tools oficiais com plataforma SDK 36 permitiram concluir Gradle e verificar a assinatura do APK localmente.

**How to apply:** prepare um SDK temporário fora do Git e passe seu caminho ao processo de build. Esse SDK não é durável entre recriações do ambiente. Compilação e assinatura verificadas não confirmam entrega FCM nem instalação em aparelho.
