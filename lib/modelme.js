/**
 * Class for all exceptions thrown by this module.
 */
function ModelMeError(message) {
    this.message = message;
}

/**
 * Represents a data model. Data types, their validation rules, and the types
 * of validation rules all exist within a model.
 */
function Model() {
    var self = this;

    var fieldTypes = {};
    var types = {};

    self.addFieldType = function(fieldType) {
        if (fieldType.name in fieldTypes)
            throw new ModelMeError("The field type '" + fieldType.name 
                + "' already exists");
        fieldTypes[fieldType.name] = fieldType;
    };

    // 
    self.getFieldType = function(name) {
        return fieldTypes[name];
    };

    // Add a new type to this model.
    self.type = function(name) {
        if (name in types)
            throw new ModelMeError("A type with name '" + name + "' already exists");

        var newType = new Type(name, self);
        types[name] = newType;
        return newType;
    };

    self.validate = function(data, typeName) {
        // make sure the specified type exists
        if (!typeName in types)
            throw new ModelMeError("The type '" + typeName + "' does not exist");

        // convert json string to object and reject other non-objects
        var obj = data;
        if (typeof data === "string")
            obj = JSON.parse(data);
        else if (typeof data !== "object")
            throw new ModelMeError("Value passed to data param of validate() function must be an object or a json string");

        // coerce final object and check for validation errors
        var errors = [];
        var type = types[typeName];
        var fieldSummary = getFieldSummary(obj, type);
        var result = {};
        for (fieldName in fieldSummary) {
            var fieldInfo = fieldSummary[fieldName];
            if (fieldInfo.field) {
                var coerced = null;
                try {
                    coerced = fieldInfo.field.coerce(fieldInfo.value);
                    var fieldErrors = fieldInfo.field.validate(coerced);
                    fieldErrors.forEach(function(err) {
                        errors.push({ field: fieldName, message: err });
                    });
                    result[fieldName] = coerced;
                }
                catch (ex) {
                    errors.push({ field: fieldName, message: ex });
                }
            }
        }

        return {
            entity: errors.length > 0 ? null : result,
            errors: errors
        };
    };

    // Setup default field types.
    self.addFieldType(stringFieldType);
    self.addFieldType(intFieldType);
    self.addFieldType(datetimeFieldType);
    self.addFieldType(arrayFieldType);

    // Creates a dictionary with a value for every field that appears in
    // obj or that has a definition in the given type. Each entry is in the
    // form { value: ___, fieldInfo: ___ } where value will be undefined
    // if it does not appear in obj and fieldInfo will be undefined if it
    // does not appear in type.
    function getFieldSummary(obj, type) {
        var fieldInfos = {};
        for (var fieldName in obj) {
            fieldInfos[fieldName] = { value: obj[fieldName] };
        }
        for (var fieldName in type.fields) {
            if (fieldName in fieldInfos)
                fieldInfos[fieldName].field = type.fields[fieldName];
            else
                fieldInfos[fieldName] = { field: type.fields[fieldName] };
        }
        return fieldInfos;
    }
}

/**
 * A type of field (like string, int, datetime, etc)
 */
function Field(opt) {
    var self = this;
    self.fieldType = opt.fieldType;
    self.name = opt.name;
    self.typeOptions = opt.typeOptions ? opt.typeOptions : { };

    // Handles the special case where a field is undefined but has a
    // default value.
    function defaultCoerce(val) {
        if (typeof self.typeOptions.defaultValue !== "undefined" && typeof val === "undefined")
            return self.typeOptions.defaultValue;
        return val;
    }

    // Convert acceptable values to more correct format. For example a
    // string field type may convert the int 7 to the string "7"
    self.coerce = function(val) {
        var afterDefault = defaultCoerce(val);
        if (self.fieldType.coerce)
            return self.fieldType.coerce(afterDefault);
        return afterDefault;
    }; 

    // Get a list of validation errors for the given value. Success means
    // an empty array.
    self.validate = function(val) {
        var errors = [];
        self.fieldType.rules.forEach(function(rule) {
            var currentError = rule(val, self.typeOptions);
            if (currentError)
                errors.push(currentError);
        });
        return errors;
    };
}

/**
 * Built-in field validation rules
 */
var rules = {
    maxLengthRule: function(val, opt) {
        if (opt.maxLength && val.length > opt.maxLength)
            return "must not be greater than " + opt.maxLength + " characters";
    },
    minLengthRule: function(val, opt) {
        if (opt.minLength && val.length < opt.minLength)
            return "must be at least " + opt.minLength + " characters";
    },
    nullRule: function(val, opt) {
        if (!opt.allowNull && val === null)
            return "must not be null";
    },
    undefinedRule: function(val, opt) {
        if (!opt.allowUndefined && typeof val === "undefined")
            return "must be defined";
    },
    minRule: function(val, opt) {
        if (val === null || typeof val === "undefined")
            return;
        if (opt.min && val < opt.min)
            return "value must be at least " + opt.min;
    },
    maxRule: function(val, opt) {
        if (val === null || typeof val === "undefined")
            return;
        if (opt.max && val > opt.max)
            return "value must not be greater than " + opt.max;
    },
    isStringRule: function(val, opt) {
        if (val === null || typeof val === "undefined")
            return;
        if (typeof val !== "string")
            return "value must be a string";
    },
    isIntRule: function(val, opt) {
        if (val === null || typeof val === "undefined")
            return;
        if (typeof val !== "number")
            return "value must be a number";
        if (val % 1 !== 0)
            return "the number " + val + " is not an integer";
    },
    isNumberRule: function(val, opt) {
        if (val === null || typeof val === "undefined")
            return;
        if (typeof val !== "number")
            return "value must be a number";
    },
    isArrayRule: function(val, opt) {
        if (val === null || typeof val === "undefined")
            return;
        if (!Array.isArray(val))
            return "value is not an array";
    },
    isDateRule: function(val, opt) {
        if (val == null || typeof val === "undefined")
            return;
        if (!(val instanceof Date))
            return "value is not a date";
    }
};

/**
 * All the default field types
 */
var stringFieldType = {
    name: "string",
    rules: [
        rules.maxLengthRule,
        rules.minLengthRule,
        rules.nullRule,
        rules.undefinedRule,
        rules.isStringRule
    ],
    coerce: function(val, opt) {
        var type = typeof val;
        if (val === null || type === "undefined" || type === "string" || !type.toString)
            return val;
        else
            return val.toString();
    }
};

var arrayFieldType = {
    name: "array",
    rules: [
        rules.maxLengthRule,
        rules.minLengthRule,
        rules.nullRule,
        rules.undefinedRule,
        rules.isArrayRule
    ],
    coerce: function(val, opt) {
        if (val === null || typeof val === "undefined" || !Array.isArray(val))
            return val;

        var newArray = [];
        val.forEach(function(el) {
            newArray.push(el);
        });
        return newArray;
    }
};

var intFieldType = {
    name: "int",
    rules: [
        rules.maxRule,
        rules.minRule,
        rules.nullRule,
        rules.undefinedRule,
        rules.isIntRule
    ],
    coerce: function(val, opt) {
        return val;
    }
};

var numberFieldType = {
    name: "number",
    rules: [
        rules.maxRule,
        rules.minRule,
        rules.nullRule,
        rules.undefinedRule,
        rules.isNumberRule
    ],
    coerce: function(val, opt) {
        return val;
    }
};

var datetimeFieldType = {
    name: "datetime",
    rules: [
        rules.maxRule,
        rules.minRule,
        rules.nullRule,
        rules.undefinedRule,
        rules.isDateRule
    ],
    coerce: function(val, opt) {
        if (val === null || type === "undefined")
            return val;

        var type = typeof val;
        if (type === "string") {
            var millis = Date.parse(val);
            if (isNaN(millis))
                throw "not a valid date string: '" + val + "'";
            return new Date(millis);
        }

        return val;
    }
};

/**
 * A data type with rules about which fields it can have and what rules it has
 */
function Type(name, model) {
    var self = this;

    if (typeof name !== "string")
        throw new ModelMeError("Type name must be a string");
    if (name.length === 0)
        throw new ModelMeError("Type name must not be empty string");

    self.name = name;
    self.model = model;
    self.fields = {};

    self.field = function(fieldName, typeName, typeOptions) {
        var fieldType = model.getFieldType(typeName);
        if (!fieldType)
            throw new ModelMeError("The type '" + typeName + "' is not valid");
        if (fieldName in self.fields)
            throw new ModelMeError("The field '" + fieldName + "' already exists on type '" + name + "'");

        var newField = new Field({
            name: fieldName,
            fieldType: fieldType,
            typeOptions: typeOptions
        });

        self.fields[fieldName] = newField;
        return newField;
    };

}

exports.Model = Model;
exports.Type = Type;
exports.Field = Field;
