const Holiday = require('../models/Holiday');
const { sendSuccess, sendError } = require('../utils/response');

const getHolidays = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { year, holidayType, startDate, endDate } = req.query;
    const holidays = await Holiday.findAll(schoolId, { year, holidayType, startDate, endDate });
    sendSuccess(res, holidays, 'Holidays retrieved successfully');
  } catch (error) {
    console.error('Get holidays error:', error);
    sendError(res, error.message, 500);
  }
};

const createHoliday = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const holiday = await Holiday.create(req.body, schoolId);
    sendSuccess(res, holiday, 'Holiday created successfully', 201);
  } catch (error) {
    console.error('Create holiday error:', error);
    sendError(res, error.message, 500);
  }
};

const updateHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    const holiday = await Holiday.update(id, req.body);
    if (!holiday) return sendError(res, 'Holiday not found', 404);
    sendSuccess(res, holiday, 'Holiday updated successfully');
  } catch (error) {
    sendError(res, error.message, 500);
  }
};

const deleteHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    const holiday = await Holiday.delete(id);
    if (!holiday) return sendError(res, 'Holiday not found', 404);
    sendSuccess(res, holiday, 'Holiday deleted successfully');
  } catch (error) {
    sendError(res, error.message, 500);
  }
};

const bulkImportHolidays = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { holidays } = req.body;

    // Map camelCase from frontend to snake_case expected by model
    const mappedHolidays = holidays.map(h => ({
      holiday_name: h.holidayName || h.holiday_name,
      holiday_date: h.holidayDate || h.holiday_date,
      holiday_type: h.holidayType || h.holiday_type || 'national',
      description: h.description || null,
      is_recurring: h.isRecurring || h.is_recurring || false
    }));

    const imported = await Holiday.bulkCreate(mappedHolidays, schoolId);
    sendSuccess(res, imported, `${imported.length} holidays imported successfully`, 201);
  } catch (error) {
    sendError(res, error.message, 500);
  }
};

module.exports = { getHolidays, createHoliday, updateHoliday, deleteHoliday, bulkImportHolidays };
