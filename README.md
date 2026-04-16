# Livros à Venda

Página de venda de livros usados, hospedada no Google Apps Script e integrada com Google Sheets.

## Estrutura da planilha

Crie uma planilha com duas abas:

### Aba `Livros`
| ID | Título | Autor | Preço | Status | ISBN | Capa_URL |
|----|--------|-------|-------|--------|------|----------|
| 1  | Dom Casmurro | Machado de Assis | 15 | Disponível | 9788535910582 | |

- **Status**: `Disponível`, `Reservado` ou `Vendido`
- **ISBN**: usado para buscar a capa automaticamente (opcional)
- **Capa_URL**: URL direta de uma imagem — tem prioridade sobre o ISBN (opcional)

### Aba `Reservas`
Deixe vazia com apenas o cabeçalho:
| ID | Livro_ID | Nome | WhatsApp | Tipo | Criado_Em | Expira_Em | Status |

## Deploy

1. Acesse [script.google.com](https://script.google.com) e crie um novo projeto
2. Cole o conteúdo de `Code.gs` no arquivo `Código.gs`
3. Crie um novo arquivo HTML chamado `index` e cole o conteúdo de `index.html`
4. Em `Code.gs`, substitua `SEU_ID_AQUI` pelo ID da sua planilha
   - O ID fica na URL: `docs.google.com/spreadsheets/d/**ID_AQUI**/edit`
5. Clique em **Implantar → Nova implantação**
   - Tipo: **Aplicativo da Web**
   - Executar como: **Eu**
   - Quem tem acesso: **Qualquer pessoa**
6. Copie a URL gerada — é ela que você compartilha no Story

## Configurar expiração automática

Após o deploy, execute a função `setupTrigger()` uma única vez pelo editor do Apps Script.
Isso cria um trigger que roda todo dia às 12h para expirar reservas vencidas.

## Atualizar um livro para Vendido

Basta editar a coluna **Status** da aba `Livros` diretamente na planilha.
