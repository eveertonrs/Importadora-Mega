USE [mega_financeiro]
GO

-- Tabela cliente_documentos
ALTER TABLE [dbo].[cliente_documentos]
ADD CONSTRAINT [FK_cliente_documentos_clientes] FOREIGN KEY ([cliente_id])
REFERENCES [dbo].[clientes] ([id])
GO

-- Tabela pedidos
ALTER TABLE [dbo].[pedidos]
ADD CONSTRAINT [FK_pedidos_clientes] FOREIGN KEY ([cliente_id])
REFERENCES [dbo].[clientes] ([id])
GO

ALTER TABLE [dbo].[pedidos]
ADD CONSTRAINT [FK_pedidos_transportadoras] FOREIGN KEY ([transportadora_id])
REFERENCES [dbo].[transportadoras] ([id])
GO

-- Tabela bloco_pedidos
ALTER TABLE [dbo].[bloco_pedidos]
ADD CONSTRAINT [FK_bloco_pedidos_blocos] FOREIGN KEY ([bloco_id])
REFERENCES [dbo].[blocos] ([id])
GO

ALTER TABLE [dbo].[bloco_pedidos]
ADD CONSTRAINT [FK_bloco_pedidos_pedidos] FOREIGN KEY ([pedido_id])
REFERENCES [dbo].[pedidos] ([id])
GO

-- Tabela bloco_lancamentos
ALTER TABLE [dbo].[bloco_lancamentos]
ADD CONSTRAINT [FK_bloco_lancamentos_blocos] FOREIGN KEY ([bloco_id])
REFERENCES [dbo].[blocos] ([id])
GO

ALTER TABLE [dbo].[bloco_lancamentos]
ADD CONSTRAINT [FK_bloco_lancamentos_pedidos] FOREIGN KEY ([pedido_id])
REFERENCES [dbo].[pedidos] ([id])
GO

ALTER TABLE [dbo].[bloco_lancamentos]
ADD CONSTRAINT [FK_bloco_lancamentos_clientes] FOREIGN KEY ([cliente_id])
REFERENCES [dbo].[clientes] ([id])
GO

ALTER TABLE [dbo].[bloco_lancamentos]
ADD CONSTRAINT [FK_bloco_lancamentos_usuarios] FOREIGN KEY ([criado_por])
REFERENCES [dbo].[usuarios] ([id])
GO

-- Tabela fechamento_itens
ALTER TABLE [dbo].[fechamento_itens]
ADD CONSTRAINT [FK_fechamento_itens_fechamento_dia] FOREIGN KEY ([data_ref])
REFERENCES [dbo].[fechamento_dia] ([data_ref])
GO

ALTER TABLE [dbo].[fechamento_itens]
ADD CONSTRAINT [FK_fechamento_itens_bloco_lancamentos] FOREIGN KEY ([lancamento_id])
REFERENCES [dbo].[bloco_lancamentos] ([id])
GO

-- Tabela dominio_itens
ALTER TABLE [dbo].[dominio_itens]
ADD CONSTRAINT [FK_dominio_itens_dominios] FOREIGN KEY ([dominio_id])
REFERENCES [dbo].[dominios] ([id])
GO

PRINT 'Chaves estrangeiras adicionadas com sucesso.';
GO
