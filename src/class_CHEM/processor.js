// TBD - When this is next done, this script should be revised to use
// "genTableAndResults"; see ABXBACT for an example.

/**
 *  The processing function for CHEM.  It is in this separate file so that it can
 *  also be used for DRUGTOX.
 * @param loincCls The LOINC class to process
 * @param clsConfig The config file data for this LOINC class.
 */
module.exports = async function (loincCls, clsConfig) {
  const equivConfig = require('../config'); // common configuration settings across classes
  const util = await require('../util').sqlUtil();

  let {query, dropTable, request, dupColumn, createHatless, applyGroup,
    applyGroupSkipPatterns, createEquivClasses, addMolecularWeights,
    equivSpreadsheet, closeConnection, dupAndApplyGroups} = util;
  const equivTable = loincCls.replace(/\//g, '')+'_EQUIV';

  try {
    // Create OXYGEN_COMP table
    await query('CREATE TABLE #OXYGEN_COMP (Name nvarchar(255))');
    let oxygenStrings = equivConfig.COMPONENT.oxygen_related;
    for (let i=0, len=oxygenStrings.length; i<len; ++i) {
      await request().input('o2', oxygenStrings[i]).query('INSERT INTO #OXYGEN_COMP VALUES (@o2)');
    };

    // Create the start of the equivalence class table
    await request().input('tableName', equivTable).input('className', loincCls).execute('create_equiv_table');

    // PROPERTY_REV
    await dupAndApplyGroups(equivTable, 'PROPERTY', clsConfig.PROPERTY);
    // One of the property groups equivlances MFr.DF and SFr.DF with non-DF
    // equivalents.  We need to set units for the DF entries for the conversion
    // to work.
    await query('UPDATE '+equivTable+ " set EXAMPLE_UCUM_UNITS = '%/100' where "+
       "PROPERTY = 'MFr.DF' or PROPERTY = 'SFr.DF'");

    // TIME_REV
    await dupAndApplyGroups(equivTable, 'TIME_ASPCT', clsConfig.TIME);

    // SYSTEM_REV
    await dupColumn(equivTable, 'SYSTEM', 'SYSTEM_REV');
    for (let group of ["DuodGastricFld", "OcularVitrFld"])
      await applyGroup(equivTable, 'SYSTEM_REV', equivConfig.SYSTEM[group], group);
    // For "Intravascular-any", do not apply when the COMPONENT is in the
    // Oxygen group, regarless of what subparts it has.
    await createHatless(equivTable, 'COMPONENT');
    let groupName = "Intravascular-any";
    let condition = 'COMPONENT_HATLESS NOT IN (select Name from #OXYGEN_COMP)'
    await applyGroup(equivTable, 'SYSTEM_REV', equivConfig.SYSTEM[groupName], groupName, condition);

    // For COMPONENTS in the oxygen group, we use different groups.  (Not really
    // needed for DrugTox, but will run the same code as for CHEM).
    condition = 'COMPONENT_HATLESS in (select Name from #OXYGEN_COMP)'
    for (let group of ["Arterial*", "Venous*"])
      await applyGroup(equivTable, 'SYSTEM_REV', clsConfig.SYSTEM[group], group, condition);

    // SCALE_REV
    if (clsConfig.SCALE)
      await dupAndApplyGroups(equivTable, 'SCALE_TYP', clsConfig.SCALE);

    // METHOD_REV
    await dupColumn(equivTable, 'METHOD_TYP', 'METHOD_REV');
    groupName = 'Method-Other';
    let skipPatterns = clsConfig.METHOD[groupName].skipPatterns;
    await applyGroupSkipPatterns(equivTable, 'METHOD_REV', skipPatterns, groupName);

    // Equivalance class name
    let classCols = ['COMPONENT','PROPERTY_REV','TIME_REV',
      'SYSTEM_REV'];
    if (clsConfig.SCALE)
      classCols.push('SCALE_REV')
    classCols.push('METHOD_REV');
    await createEquivClasses(equivTable, classCols);

    // Molecular weights column
    await addMolecularWeights(equivTable);

    // Add Warnings column.  So far only CHEM has data for this, but we will let
    // it run for Drug/Tox'.
    await query('ALTER TABLE '+equivTable+' ADD WARNING nvarchar(255)');
    let warnings = clsConfig.warning
    for (let warning of warnings) {
      let req = request();
      req.input('msg', warning.message);
      let conditions = warning.conditions;
      let queryStr = 'UPDATE '+equivTable+' set WARNING = @msg ';
      let condCols = Object.keys(conditions);
      for (let i=0, len=condCols.length; i<len; ++i) {
        queryStr += i===0 ? ' WHERE (' : ') AND (';
        let col = condCols[i];
        let vals = conditions[col];
        for (let j=0, jLen=vals.length; j<jLen; ++j) {
          if (j != 0)
            queryStr += ' OR '
          let valInput = col+j;
          req.input(valInput, vals[j]);
          queryStr += col +'=@' + valInput;
        }
      }
      queryStr += ')';
      await req.query(queryStr);
    }

    // Genereate the output
    await equivSpreadsheet(equivTable);
  }
  catch (e) {
    console.error(e);
    process.exit(1); // signal error
  }
  finally {
    await closeConnection();
  }
}
