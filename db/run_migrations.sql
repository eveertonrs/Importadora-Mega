USE [mega_financeiro]
GO

-- Executa os scripts de migração

:r db/migrations/001_add_percentual_nf_to_cliente_documentos.sql
:r db/002_add_foreign_keys.sql
:r db/003_add_indexes.sql
:r db/004_add_constraints.sql

PRINT 'Scripts de migração executados com sucesso.';
GO
