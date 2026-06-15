-- ProMate Database Schema
-- Microsoft SQL Server

CREATE TABLE [location] (
  [id] INT IDENTITY(1,1),
  [name] NVARCHAR(100) NOT NULL,
  [place] NVARCHAR(100) NULL,
  [barcode] NVARCHAR(100) NULL,
  PRIMARY KEY ([id])
);

CREATE TABLE [position] (
  [id] INT IDENTITY(1,1),
  [name] NVARCHAR(100) NOT NULL,
  PRIMARY KEY ([id])
);

CREATE TABLE [permission] (
  [id] INT IDENTITY(1,1),
  [name] NVARCHAR(100) NOT NULL,
  PRIMARY KEY ([id])
);

CREATE TABLE [phase] (
  [id] INT IDENTITY(1,1),
  [name] NVARCHAR(100) NOT NULL,
  [location_id] INT NULL,
  [type] NVARCHAR(50) NULL,
  PRIMARY KEY ([id]),
  FOREIGN KEY ([location_id]) REFERENCES [location]([id])
);

CREATE TABLE [material] (
  [id] INT IDENTITY(1,1),
  [name] NVARCHAR(255) NOT NULL,
  [cost] DECIMAL(10,2) NULL,
  [unit] NVARCHAR(20) NULL,
  [density] DECIMAL(10,4) NULL,
  [barcode] NVARCHAR(100) NULL,
  PRIMARY KEY ([id])
);

CREATE TABLE [cooperation] (
  [id] INT IDENTITY(1,1),
  [name] NVARCHAR(255) NOT NULL,
  [cost] DECIMAL(10,2) NULL,
  [unit] NVARCHAR(20) NULL,
  [barcode] NVARCHAR(100) NULL,
  PRIMARY KEY ([id])
);

CREATE TABLE [operation] (
  [id] INT IDENTITY(1,1),
  [name] NVARCHAR(100) NOT NULL,
  [hour_cost] DECIMAL(10,2) NULL,
  [number_of_workers] INT DEFAULT 1,
  [barcode] NVARCHAR(100) NULL,
  PRIMARY KEY ([id])
);

CREATE TABLE [machine] (
  [id] INT IDENTITY(1,1),
  [name] NVARCHAR(100) NOT NULL,
  [type] NVARCHAR(50) NULL,
  PRIMARY KEY ([id])
);

CREATE TABLE [user] (
  [id] INT IDENTITY(1,1),
  [name] NVARCHAR(100) NOT NULL,
  [surname] NVARCHAR(100) NOT NULL,
  [email] NVARCHAR(255) NULL,
  [password_hash] NVARCHAR(255) NULL,
  [position_id] INT NULL,
  [barcode] NVARCHAR(100) NULL,
  [is_active] BIT DEFAULT 1,
  [rfid_uid] NVARCHAR(50) NULL,
  [created_at] DATETIME DEFAULT GETDATE(),
  PRIMARY KEY ([id]),
  FOREIGN KEY ([position_id]) REFERENCES [position]([id])
);

CREATE TABLE [position_permission] (
  [id] INT IDENTITY(1,1),
  [position_id] INT NOT NULL,
  [permission_id] INT NOT NULL,
  PRIMARY KEY ([id]),
  FOREIGN KEY ([position_id]) REFERENCES [position]([id]),
  FOREIGN KEY ([permission_id]) REFERENCES [permission]([id])
);

CREATE TABLE [machine_assignment] (
  [id] INT IDENTITY(1,1),
  [user_id] INT NOT NULL,
  [machine_id] INT NOT NULL,
  [assigned_at] DATETIME DEFAULT GETDATE(),
  [unassigned_at] DATETIME NULL,
  PRIMARY KEY ([id]),
  FOREIGN KEY ([user_id]) REFERENCES [user]([id]),
  FOREIGN KEY ([machine_id]) REFERENCES [machine]([id])
);

CREATE TABLE [user_operation] (
  [id] INT IDENTITY(1,1),
  [user_id] INT NOT NULL,
  [operation_id] INT NOT NULL,
  PRIMARY KEY ([id]),
  FOREIGN KEY ([user_id]) REFERENCES [user]([id]),
  FOREIGN KEY ([operation_id]) REFERENCES [operation]([id])
);

CREATE TABLE [order] (
  [id] INT IDENTITY(1,1),
  [order_number] NVARCHAR(100) NOT NULL,
  [MOS_number] NVARCHAR(100) NULL,
  [created_at] DATETIME DEFAULT GETDATE(),
  [closed_at] DATETIME NULL,
  [folder_path] NVARCHAR(500) NULL,
  [all_drawings] BIT DEFAULT 0,
  [barcode] NVARCHAR(100) NULL,
  [phase_id] INT NULL,
  PRIMARY KEY ([id]),
  FOREIGN KEY ([phase_id]) REFERENCES [phase]([id])
);

CREATE TABLE [part] (
  [id] INT IDENTITY(1,1),
  [order_id] INT NOT NULL,
  [symbol] NVARCHAR(50) NULL,
  [part_number] NVARCHAR(50) NOT NULL,
  [name] NVARCHAR(255) NOT NULL,
  [quantity_right] INT NOT NULL DEFAULT 0,
  [quantity_left] INT NOT NULL DEFAULT 0,
  [deadline_at] DATETIME NULL,
  [paths_id] INT NULL,
  [price_id] INT NULL,
  [phase_id] INT NULL,
  [rework_parent_part_id] INT NULL,
  [location_id] INT NULL,
  [card_printed] BIT DEFAULT 0,
  [sticker_printed] BIT DEFAULT 0,
  [sticker_printed_at] DATETIME NULL,
  [barcode] NVARCHAR(100) NULL,
  [finished_at] DATETIME NULL,
  PRIMARY KEY ([id]),
  FOREIGN KEY ([order_id]) REFERENCES [order]([id]),
  FOREIGN KEY ([phase_id]) REFERENCES [phase]([id]),
  FOREIGN KEY ([rework_parent_part_id]) REFERENCES [part]([id]),
  FOREIGN KEY ([location_id]) REFERENCES [location]([id])
);

CREATE TABLE [paths] (
  [id] INT IDENTITY(1,1),
  [part_id] INT NOT NULL,
  [PDF_path] NVARCHAR(500) NULL,
  [DWG_path] NVARCHAR(500) NULL,
  [STP_path] NVARCHAR(500) NULL,
  [CAM_path] NVARCHAR(500) NULL,
  [card_path] NVARCHAR(500) NULL,
  [all_drawings] BIT DEFAULT 0,
  PRIMARY KEY ([id]),
  FOREIGN KEY ([part_id]) REFERENCES [part]([id])
);

CREATE TABLE [price] (
  [id] INT IDENTITY(1,1),
  [part_id] INT NOT NULL,
  [cost_commercial_part] DECIMAL(10,2) DEFAULT 0,
  [cost_labor_hour] DECIMAL(10,2) DEFAULT 0,
  [cost_cooperation] DECIMAL(10,2) DEFAULT 0,
  [cost_machining] DECIMAL(10,2) DEFAULT 0,
  [price_kit] DECIMAL(10,2) DEFAULT 0,
  [price_piece] DECIMAL(10,2) DEFAULT 0,
  PRIMARY KEY ([id]),
  FOREIGN KEY ([part_id]) REFERENCES [part]([id])
);

CREATE TABLE [form_log] (
  [id] INT IDENTITY(1,1),
  [part_id] INT NOT NULL,
  [commercial_id] INT NULL,
  [dim_a_est] DECIMAL(10,2) NULL,
  [dim_b_est] DECIMAL(10,2) NULL,
  [dim_c_est] DECIMAL(10,2) NULL,
  [material_est_id] INT NULL,
  [dim_a_real] DECIMAL(10,2) NULL,
  [dim_b_real] DECIMAL(10,2) NULL,
  [dim_c_real] DECIMAL(10,2) NULL,
  [area_one] DECIMAL(10,4) NULL,
  [weight_one] DECIMAL(10,4) NULL,
  [weight_real_set] BIT DEFAULT 0,
  [material_id] INT NULL,
  [cost_kit] DECIMAL(10,2) NULL,
  PRIMARY KEY ([id]),
  FOREIGN KEY ([part_id]) REFERENCES [part]([id]),
  FOREIGN KEY ([material_est_id]) REFERENCES [material]([id]),
  FOREIGN KEY ([material_id]) REFERENCES [material]([id])
);

CREATE TABLE [commercial] (
  [id] INT IDENTITY(1,1),
  [form_id] INT NOT NULL,
  [cost] DECIMAL(10,2) NULL,
  [ordered_at] DATETIME NULL,
  [arrived_at] DATETIME NULL,
  [phase_id] INT NULL,
  PRIMARY KEY ([id]),
  FOREIGN KEY ([form_id]) REFERENCES [form_log]([id]),
  FOREIGN KEY ([phase_id]) REFERENCES [phase]([id])
);

CREATE TABLE [operation_logs] (
  [id] INT IDENTITY(1,1),
  [part_id] INT NOT NULL,
  [operation_id] INT NOT NULL,
  [phase_id] INT NULL,
  [time_estimated] DECIMAL(10,2) NULL,
  [time_real] DECIMAL(10,2) NULL,
  [operation_order] INT DEFAULT 0,
  [barcode] NVARCHAR(100) NULL,
  [cost] DECIMAL(10,2) NULL,
  PRIMARY KEY ([id]),
  FOREIGN KEY ([part_id]) REFERENCES [part]([id]),
  FOREIGN KEY ([operation_id]) REFERENCES [operation]([id]),
  FOREIGN KEY ([phase_id]) REFERENCES [phase]([id])
);

CREATE TABLE [operation_time_logs] (
  [id] INT IDENTITY(1,1),
  [operation_id] INT NULL,
  [cooperation_id] INT NULL,
  [start_date] DATETIME NULL,
  [finish_date] DATETIME NULL,
  [user_id] INT NULL,
  [machine_id] INT NULL,
  [barcode] NVARCHAR(100) NULL,
  PRIMARY KEY ([id]),
  FOREIGN KEY ([operation_id]) REFERENCES [operation_logs]([id]),
  FOREIGN KEY ([cooperation_id]) REFERENCES [cooperation]([id]),
  FOREIGN KEY ([user_id]) REFERENCES [user]([id]),
  FOREIGN KEY ([machine_id]) REFERENCES [machine]([id])
);
