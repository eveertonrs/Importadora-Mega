-- Adiciona a coluna percentual_nf na tabela cliente_documentos
-- Esta coluna armazenará o percentual da nota fiscal (ex: 1.00 para 100%, 0.50 para 50%)

IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[cliente_documentos]') 
    AND name = 'percentual_nf'
)
BEGIN
    ALTER TABLE [dbo].[cliente_documentos]
    ADD [percentual_nf] DECIMAL(4, 2) NOT NULL DEFAULT 1.00;

    PRINT 'Coluna [percentual_nf] adicionada com sucesso na tabela [cliente_documentos].';
END
ELSE
BEGIN
    PRINT 'Coluna [percentual_nf] já existe na tabela [cliente_documentos].';
END
GO
