-- Procedure dup_column:  Creates a copy of a column.
-- CAUTION:  Column names are just inserted into the SQL without checking
-- Parameters:
--   tableName - the name of the table
--   sourceCol - the name of the source column
--   destCol - the name of the new column to be created with a copy of sourceCol
if object_id('dup_column') is not NULL
   DROP PROCEDURE dup_column;
GO
CREATE PROCEDURE dup_column @tableName nvarchar(255), @sourceCol nvarchar(255), @destCol nvarchar(255)
as
BEGIN
  EXEC('ALTER TABLE '+@tableName+' ADD '+@destCol +' nvarchar(255)');
  EXEC('UPDATE '+@tableName+' SET '+@sourceCol+' = '''' where '+@sourceCol+' is null'); -- cleanup
  EXEC('UPDATE '+@tableName+' SET '+@destCol+' = '+@sourceCol);
END;
GO


-- Procedure:  Creates a new equivalence table as a subset of the LOINC table.
-- Parameters:
--   tableName - the name of the table
--   className - the value of the class field for the selected records.  This defines the subset.
if object_id('create_equiv_table') is not NULL
   DROP PROCEDURE create_equiv_table;
GO
CREATE PROCEDURE create_equiv_table @tableName nvarchar(255), @className nvarchar(255)
as
BEGIN
  DECLARE @sql nvarchar(255);
  IF OBJECT_ID(@tableName, 'U') IS NOT NULL
  BEGIN
    SET @sql = N'drop table '+quotename(@tableName);
    EXEC sp_executeSQL @sql
  END;
  SET @sql = N'select * into '+quotename(@tableName)+
    N' from [relma].[dbo].[LOINC] where CLASS=@className'
  EXEC sp_executeSQL @sql,
    N'@tableName nvarchar(255), @className nvarchar(255)',
    @tableName = @tableName, @className=@className;
  -- Deal with columns that do not allow nulls
  SET @sql = N'ALTER TABLE '+quotename(@tableName)+' DROP COLUMN ID;'
  EXEC sp_executeSQL @sql
  -- Allow nulls (because of header rows)
  SET @sql = N'ALTER TABLE '+quotename(@tableName)+' ALTER COLUMN LOINC_NUM nvarchar(10) NULL;'
  EXEC sp_executeSQL @sql
  SET @sql = N'ALTER TABLE '+quotename(@tableName)+' ALTER COLUMN COMPONENT nvarchar(255) NULL;'
  EXEC sp_executeSQL @sql
  SET @sql = N'ALTER TABLE '+quotename(@tableName)+' ALTER COLUMN CLASS nvarchar(255) NULL;'
  EXEC sp_executeSQL @sql
  SET @sql = N'ALTER TABLE '+quotename(@tableName)+' ALTER COLUMN [STATUS] nvarchar(255) NULL;'
  EXEC sp_executeSQL @sql
  SET @sql = N'ALTER TABLE '+quotename(@tableName)+' ALTER COLUMN CLASSTYPE int NULL;'
  EXEC sp_executeSQL @sql
  SET @sql = N'ALTER TABLE '+quotename(@tableName)+' ALTER COLUMN COMMON_TEST_RANK int NULL;'
  EXEC sp_executeSQL @sql
  SET @sql = N'ALTER TABLE '+quotename(@tableName)+' ALTER COLUMN COMMON_SI_TEST_RANK int NULL;'
  EXEC sp_executeSQL @sql
  SET @sql = N'ALTER TABLE '+quotename(@tableName)+' ALTER COLUMN COMMON_ORDER_RANK int NULL;'
  EXEC sp_executeSQL @sql
  END;
GO

