USE [mega_financeiro]
GO

-- Constraints para garantir a integridade dos dados

-- Tabela bloco_lancamentos
ALTER TABLE [dbo].[bloco_lancamentos] WITH CHECK ADD CHECK (([status]='CANCELADO' OR [status]='DEVOLVIDO' OR [status]='LIQUIDADO' OR [status]='PENDENTE'))
GO

ALTER TABLE [dbo].[bloco_lancamentos] WITH CHECK ADD CHECK (([tipo_cheque]='TERCEIRO' OR [tipo_cheque]='PROPRIO'))
GO

-- Tabela blocos
ALTER TABLE [dbo].[blocos] WITH CHECK ADD CHECK (([status]='FECHADO' OR [status]='ABERTO'))
GO

-- Tabela cliente_documentos
ALTER TABLE [dbo].[cliente_documentos] WITH CHECK ADD CHECK (([doc_tipo]='CNPJ' OR [doc_tipo]='CPF'))
GO

-- Tabela clientes
ALTER TABLE [dbo].[clientes] WITH CHECK ADD CHECK (([status]='INATIVO' OR [status]='ATIVO'))
GO

-- Tabela fechamento_itens
ALTER TABLE [dbo].[fechamento_itens] WITH CHECK ADD CHECK (([status_no_dia]='CANCELADO' OR [status_no_dia]='PENDENTE' OR [status_no_dia]='RECEBIDO'))
GO

-- Tabela usuarios
ALTER TABLE [dbo].[usuarios] WITH CHECK ADD CHECK (([permissao]='vendedor' OR [permissao]='financeiro' OR [permissao]='admin'))
GO

PRINT 'Constraints adicionados com sucesso.';
GO
