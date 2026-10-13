---
name: Codificação do login no Windows
description: Manter identificadores HTTP em ASCII sem retirar acentos do nome visível do aplicativo.
---

Use somente ASCII em identificadores de protocolo e cabeçalhos HTTP do aplicativo desktop, mesmo quando o nome visível tem acentos.

**Why:** o nome localizado do programa entrou no User-Agent do Electron como bytes Latin-1. O Supabase Auth rejeitou esses bytes ao gravar uma sessão no PostgreSQL UTF-8, retornando “Database error granting user” apesar de o login Android funcionar. O usuário confirmou que normalizar o identificador técnico resolveu o login no Windows real, sem retirar os acentos do nome visível.

**How to apply:** mantenha nome e identidade visual localizados, mas normalize o identificador técnico antes da primeira navegação. Quando esse erro ocorrer, consulte os registros de Auth e do banco antes de redefinir senhas ou alterar permissões.
