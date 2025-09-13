USE [mega_financeiro]
GO

-- Índices para otimizar consultas

-- Tabela cliente_documentos
CREATE NONCLUSTERED INDEX IX_cliente_documentos_cliente_id ON dbo.cliente_documentos (cliente_id);

-- Tabela pedidos
CREATE NONCLUSTERED INDEX IX_pedidos_cliente_id ON dbo.pedidos (cliente_id);
CREATE NONCLUSTERED INDEX IX_pedidos_transportadora_id ON dbo.pedidos (transportadora_id);

-- Tabela bloco_pedidos
CREATE NONCLUSTERED INDEX IX_bloco_pedidos_bloco_id ON dbo.bloco_pedidos (bloco_id);
CREATE NONCLUSTERED INDEX IX_bloco_pedidos_pedido_id ON dbo.bloco_pedidos (pedido_id);

-- Tabela bloco_lancamentos
CREATE NONCLUSTERED INDEX IX_bloco_lancamentos_bloco_id ON dbo.bloco_lancamentos (bloco_id);
CREATE NONCLUSTERED INDEX IX_bloco_lancamentos_pedido_id ON dbo.bloco_lancamentos (pedido_id);
CREATE NONCLUSTERED INDEX IX_bloco_lancamentos_cliente_id ON dbo.bloco_lancamentos (cliente_id);
CREATE NONCLUSTERED INDEX IX_bloco_lancamentos_criado_por ON dbo.bloco_lancamentos (criado_por);

-- Tabela fechamento_itens
CREATE NONCLUSTERED INDEX IX_fechamento_itens_fechamento_id ON dbo.fechamento_itens (fechamento_id);
CREATE NONCLUSTERED INDEX IX_fechamento_itens_lancamento_id ON dbo.fechamento_itens (lancamento_id);

-- Tabela dominio_itens
CREATE NONCLUSTERED INDEX IX_dominio_itens_dominio_id ON dbo.dominio_itens (dominio_id);

PRINT 'Índices adicionados com sucesso.';
GO
