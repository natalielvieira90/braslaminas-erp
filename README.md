# BrasLâminas

E-commerce de lâminas e insumos para microscopia.

## Estrutura

```
backend/    API Node.js + Express
frontend/   Site estático (HTML/CSS/JS)
database/   Migrações SQL
docs/       Documentação
tests/      Testes
```

## Como rodar

Requisitos: Node.js 18+ e PostgreSQL 16+.

### Opção A — Scripts do projeto (Windows/PowerShell, PostgreSQL próprio)

O projeto usa uma instância PostgreSQL própria (porta 5433, dados em `%LOCALAPPDATA%\braslaminas-pgdata`), sem conflitar com o PostgreSQL do sistema.

```powershell
# 1. Suba o banco do projeto (cria a instância na primeira vez)
powershell -ExecutionPolicy Bypass -File scripts\start-db.ps1

# 2. Configure o ambiente
cd backend
Copy-Item .env.example .env   # já está pronto para a instância do projeto (porta 5433)

# 3. Instale dependências
npm install

# 4. Crie as tabelas e os dados iniciais
npm run db:setup

# 5. Inicie a API (serve também o frontend)
powershell -ExecutionPolicy Bypass -File ..\scripts\start-api.ps1
```

Acesse `http://localhost:3000`.

Para parar o banco do projeto: `powershell -ExecutionPolicy Bypass -File scripts\stop-db.ps1`.

### Opção B — Docker Compose

```bash
docker compose up --build
```

A API sobe em `http://localhost:3000`.

### Opção C — Local (PostgreSQL existente)

```bash
# 1. Crie o banco braslaminas no seu PostgreSQL
# 2. Configure as variáveis de ambiente
cd backend
cp .env.example .env

# 3. Instale dependências
npm install

# 4. Crie as tabelas e os dados iniciais
npm run db:setup

# 5. Inicie o servidor
npm run dev
```

Acesse `http://localhost:3000` (o frontend estático é servido pela API).

## Credenciais do admin (seed)

- E-mail: `admin@braslaminas.com.br`
- Senha: `admin123`

## Endpoints da API

| Método | Rota                       | Descrição                        | Auth    |
| ------ | -------------------------- | -------------------------------- | ------- |
| POST   | `/api/auth/register`       | Cadastrar usuário                | —       |
| POST   | `/api/auth/login`          | Login (retorna JWT)              | —       |
| GET    | `/api/auth/me`             | Dados do usuário logado          | Bearer  |
| GET    | `/api/products`            | Listar produtos (filtros)        | —       |
| GET    | `/api/products/:slug`      | Detalhes de um produto           | —       |
| POST   | `/api/products`            | Criar produto                    | Admin   |
| PUT    | `/api/products/:id`        | Atualizar produto                | Admin   |
| DELETE | `/api/products/:id`        | Remover produto                  | Admin   |
| GET    | `/api/cart`                | Ver carrinho                     | Bearer  |
| POST   | `/api/cart`                | Adicionar item ao carrinho       | Bearer  |
| PUT    | `/api/cart/:product_id`    | Atualizar quantidade             | Bearer  |
| DELETE | `/api/cart/:product_id`    | Remover item do carrinho         | Bearer  |
| POST   | `/api/orders`              | Finalizar pedido (checkout)      | Bearer  |
| GET    | `/api/orders`              | Listar pedidos                   | Bearer  |
| GET    | `/api/orders/:id`          | Detalhes do pedido               | Bearer  |
| POST   | `/api/upload/image`        | Upload de imagem (multipart)     | Admin   |
| POST   | `/api/contact`             | Enviar mensagem de contato       | —       |

Autenticação: enviar `Authorization: Bearer <token>`.

Filtros de produtos: `?category=`, `?search=`, `?limit=` (padrão 50, máx 100), `?offset=`.

## Páginas

- `/` — home com destaques
- `/pages/produtos.html` — catálogo com busca/filtro
- `/pages/produto.html?slug=...` — detalhe do produto
- `/pages/login.html` — entrar / criar conta
- `/pages/carrinho.html` — carrinho e checkout
- `/pages/pedidos.html` — meus pedidos
- `/pages/admin.html` — painel admin (CRUD de produtos + upload de imagem)
- `/pages/contato.html` — formulário de contato

## Testes

```bash
cd backend
npm test
```
