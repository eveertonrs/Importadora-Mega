CREATE TABLE pagamentos (
  id INT PRIMARY KEY IDENTITY(1,1),
  cliente_id INT NOT NULL,
  data_lancamento DATETIME NOT NULL,
  data_vencimento DATETIME NOT NULL,
  valor DECIMAL(18,2) NOT NULL,
  forma_pagamento VARCHAR(255) NOT NULL,
  observacoes VARCHAR(255),
  FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);

CREATE TABLE cheques (
  id INT PRIMARY KEY IDENTITY(1,1),
  pagamento_id INT NOT NULL,
  banco VARCHAR(255) NOT NULL,
  numero VARCHAR(255) NOT NULL,
  data_deposito DATETIME NOT NULL,
  FOREIGN KEY (pagamento_id) REFERENCES pagamentos(id)
);

CREATE TABLE movimentacoes (
  id INT PRIMARY KEY IDENTITY(1,1),
  pagamento_id INT NOT NULL,
  data DATETIME NOT NULL,
  descricao VARCHAR(255) NOT NULL,
  valor DECIMAL(18,2) NOT NULL,
  FOREIGN KEY (pagamento_id) REFERENCES pagamentos(id)
);
