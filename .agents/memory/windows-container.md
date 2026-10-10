---
name: Empacotamento Windows no container
description: Limitação não óbvia de Wine ao finalizar instaladores NSIS neste ambiente.
---

Finalize e valide o instalador NSIS em Windows, não considere o executável parcial gerado em Linux uma entrega pronta.

**Why:** o Wine Nix padrão usa um loader de 32 bits que este container não executa; Wine64 inicia, mas a finalização NSIS falhou nos serviços RPCSS mesmo após corrigir a resolução do comando.

**How to apply:** prefira o runner Windows da compilação automatizada ou uma máquina Windows. Não desative a edição de recursos para contornar Wine: isso pode deixar o EXE com o ícone do Electron em vez do ícone oficial.
