# tools/playbook — Index

↩ [nível acima](../../INDEX.md)

- [generate-playbook.py](generate-playbook.py) — gera `PLAYBOOK.md` e
  `PLAYBOOK.index.json` das fontes declaradas (`--write` regenera, `--check`
  valida frescor, exit 2 = drift).
- [judge-playbook.py](judge-playbook.py) — juiz de conformidade da projeção
  enviada (`--check-sent`).
- [playbook-sources.txt](playbook-sources.txt) — lista de fontes que alimentam
  a projeção.
- [hooks/](hooks/) — hook `pre-commit` anti-drift (ativado via
  `git config core.hooksPath tools/playbook/hooks`).
