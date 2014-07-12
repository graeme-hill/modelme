var ModelMe = require("../lib/modelme.js");

exports.coerceDefault = function(test) {
    var model = new ModelMe.Model();
    var personType = model.type("Person");
    var nameField = personType.field("name", "string", {
        defaultValue: "-"
    });

    test.strictEqual(nameField.coerce(undefined), "-");
    test.done();
};

exports.doNotCoerceDefault = function(test) {
    var model = new ModelMe.Model();
    var personType = model.type("Person");
    var nameField = personType.field("name", "string");
    test.strictEqual(typeof nameField.coerce(undefined), "undefined");
    test.done();
};

exports.disallowNullByDefault = function(test) {
    var model = new ModelMe.Model();
    var personType = model.type("Person");
    var nameField = personType.field("name", "string");
    var person = { name: null };
    var result = model.validate(person, "Person");
    test.strictEqual(1, result.errors.length);
    test.done();
};

exports.errorOnWrongType = function(test) {
    var model = new ModelMe.Model();
    var personType = model.type("Person");
    var ageField = personType.field("age", "int");
    var person = { age: new Date() };
    var result = model.validate(person, "Person");
    test.strictEqual(1, result.errors.length);
    test.done();
}
    
exports.allowNull = function(test) {
    var model = new ModelMe.Model();
    var personType = model.type("Person");
    var nameField = personType.field("name", "string", {
        allowNull: true
    });
    var person = { name: null };
    var result = model.validate(person, "Person");
    test.strictEqual(0, result.errors.length);
    test.done();
};

exports.disallowNull = function(test) {
    var model = new ModelMe.Model();
    var personType = model.type("Person");
    var nameField = personType.field("name", "string", {
        allowNull: false
    });
    var person = { name: null };
    var result = model.validate(person, "Person");
    test.strictEqual(1, result.errors.length);
    test.done();
};

function createSimplePersonModel() {
    var model = new ModelMe.Model();
    var personType = model.type("Person");
    personType.field("name", "string", {
        minLength: 1,
        maxLength: 20
    });
    personType.field("age", "int", {
        min: 0,
        max: 200
    });
    personType.field("created", "datetime", {
        defaultValue: function() { return new Date(); }
    });
    return model;
};

function createModelWithSimpleArray() {
    var model = new ModelMe.Model();
    var personType = model.type("Person");
    personType.field("name", "string", {
        minLength: 1,
        maxLength: 20
    });
    personType.field("favoriteNumbers", "array", {
        elementType: { mode: "simple", type: "int" },
        defaultValue: []
    });
    return model;
};

function createRecursivePersonModel() {
    var model = new ModelMe.Model();
    var personType = model.type("Person");
    personType.field("name", "string", {
        minLength: 1,
        maxLength: 20
    });
    personType.field("age", "int", {
        min: 0,
        max: 200
    });
    personType.field("created", "datetime", {
        defaultValue: function() { return new Date(); }
    });
    personType.field("friends", "array", {
        elementType: { mode: "complex", type: "Person" },
        defaultValue: []
    });
    return model;
};

exports.simpleValidWithAllFields = function(test) {
    debugger;
    var now = new Date();
    var person = {
        name: "Graeme",
        age: 27,
        created: now
    };
    var model = createSimplePersonModel();
    var result = model.validate(person, "Person");
    test.strictEqual(0, result.errors.length);
    test.strictEqual("Graeme", result.entity.name);
    test.strictEqual(27, result.entity.age);
    test.strictEqual(now, result.entity.created);
    test.done();
};

exports.simpleValidWithStringDate = function(test) {
    var nowString = "2014-01-01 12:00";
    var person = {
        name: "Graeme",
        age: 27,
        created: nowString
    };
    var model = createSimplePersonModel();
    var result = model.validate(person, "Person");
    test.strictEqual(0, result.errors.length);
    test.strictEqual(new Date(nowString).getTime(), 
        result.entity.created.getTime());
    test.done();
};

exports.simpleInvalidWithBadDateString = function(test) {
    var person = {
        name: "Graeme",
        age: 27,
        created: "this is not a valid date string"
    };
    var model = createSimplePersonModel();
    var result = model.validate(person, "Person");
    test.strictEqual(1, result.errors.length);
    test.strictEqual(null, result.entity);
    test.done();
};

exports.recursiveComplex = function(test) {
    var nowString = "2014-01-01 12:00";
    var person = {
        name: "Graeme",
        age: 27,
        created: nowString,
        friends: [
        {
            name: "Hayley",
            age: 26,
            created: nowString,
            friends: [
            {
                name: "Elly",
                age: 2,
                created: new Date()
            },
            {
                name: "Superman",
                age: 30,
                created: new Date()
            }
            ]
        }
        ]
    };
    var model = createRecursivePersonModel();
    var result = model.validate(person, "Person");

    // should be no validation errors
    test.strictEqual(0, result.errors.length);

    // check that friend structure was maintained
    test.strictEqual(1, result.entity.friends.length);
    test.strictEqual(2, result.entity.friends[0].friends.lenth);
    test.strictEqual("Graeme", result.entity.name);
    test.strictEqual("Hayley", result.entity.friends[0].name);
    test.strictEqual("Elly", result.entity.friends[0].friends[0].name);
    test.strictEqual("Superman", result.entity.friends[0].friends[1].name);

    // make sure none of the dates stayed as strings
    test.strictEqual("object", typeof result.entity.created);
    test.strictEqual("object", typeof result.entity.friends[0].created);
    test.strictEqual("object", typeof result.entity.friends[0].friends[0].created);
    test.strictEqual("object", typeof result.entity.friends[0].friends[1].created);

    // verify that it is a deep copy by checking that the strings dates in the
    // original are still strings
    test.strictEqual(nowString, person.created);
    test.strictEqual(nowString, person.friends[0].created);

    test.done();
};
