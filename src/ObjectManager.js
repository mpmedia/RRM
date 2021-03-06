"use strict";

var ObjectManager = function() {
    this.proxyFactory = new ProxyFactory();

    var self = this;

    var objectMap = {};

    /**
     * Store this entity into the object map for later reference
     *
     * @param entityClass
     * @param entity
     */
    var addToObjectMap = function(entityClass, entity) {
        var name = entityClass.$name;
        objectMap[name] = objectMap[name] || [];
        if (objectMap[name].indexOf(entity) < 0) {
            objectMap[name].push(entity);
        }
    }

    /**
     * Fetch the references entity from the object map or null if it is not stored.
     *
     * @param entityClass
     * @param id
     * @returns entity|null
     */
    var getFromObjectMap = function(entityClass, id) {
        if (id === undefined) {
            return null;
        }
        if (!(entityClass.$name in objectMap)) {
            return null;
        }
        var map = objectMap[entityClass.$name];
        for (var i in map) {
            if (map[i].id == id) {
                return map[i];
            }
        }
        return null;
    }

    /**
     * When constructing the entity class, this method will add the property as defined in the schema.
     *
     * @param entity
     * @param name
     * @param property
     * @param data the value
     */
    var defineProperty = function(entity, name, property, data) {
        if (!('transform' in property)) {
            throw Error('transform is mandatory');
        }

        self.loadPropertyValue(entity, name, property, data);

        var definition = {};

        if (property.readable) {
            definition.get = function() {
                return entity.$values[name];
            }
        }

        if (property.writable) {
            definition.set = function(value) {
                entity.$dirty = true;
                entity.$values[name] = property.transform(value, this);
            }
        }

        definition.enumerable = true;

        Object.defineProperty(entity, name, definition);
    };

    /**
     * With the original data, first update the $raw object with it, then transform the value and
     * store the result in the $values object
     *
     * @param entity
     * @param name
     * @param property
     * @param data
     */
    this.loadPropertyValue = function(entity, name, property, data) {
        entity.$raw[name] = data[name];
        entity.$values[name] = property.transform(data[name], this);
    }

    /**
     * Update the data of an existing entity
     *
     * @param existing
     * @param data
     */
    this.update = function(existing, data) {
        for (var i in existing.$schema) {
            self.loadPropertyValue(existing, i, existing.$schema[i], data);
        }
    }

    /**
     * Create an entity with the specified data. If the entity already exists, the data is updated in that entity
     * instead. If the entity already exists as an unloaded Proxy, the Proxy will be loaded with the specified data.
     *
     * @param entityClass
     * @param data
     * @returns entity object (new or existing)
     */
    this.create = function(entityClass, data) {
        var entity = Object.create(entityClass.prototype, {
            $values: { value: {} },
            $raw: { value: {} },
            $dirty: { value: false, writable: true }
        });

        data = data || {};

        for (var i in entity.$schema) {
            defineProperty(entity, i, entity.$schema[i], data);
        }

        var existing = getFromObjectMap(entityClass, data.id);
        if (null !== existing) {
            if (!(existing instanceof this.proxyFactory.getProxyClass(entityClass))) {
                this.update(existing, data);
                return existing;
            }

            existing.object = entity;

            entityClass.constructor.call(existing);
            return existing;
        }
        entityClass.constructor.call(entity);

        addToObjectMap(entityClass, entity);
        return entity;
    };

    /**
     * Fetch an entity by ID
     *
     * @param entityClass
     * @param id
     * @throws Error if the entity is not loaded or proxied
     * @returns {entity|null}
     */
    this.get = function(entityClass, id) {
        var entity = getFromObjectMap(entityClass, id);
        if (null === entity) {
            throw Error('not loaded');
        }

        return entity;
    }

    /**
     * Fetch all entities of the specified class
     *
     * @param entityClass
     * @returns Object of entities mapped by ID
     */
    this.getAll = function(entityClass) {
        return objectMap[entityClass.$name] || {};
    }

    /**
     * Convert the entity to a simple object
     * @param entity
     * @returns object
     */
    this.toArray = function(entity) {
        var data = {};
        for (var i in entity.$schema) {
            if (entity.$schema[i].persistable) {
                data[i] = entity.$schema[i].reverseTransform(entity[i], this);
            }
        }
        return data;
    }

    /**
     * Does the same as this.get(), but instead of throwing an Error, it will create a Proxy object if the entity is
     * not loaded.
     *
     * @param entityClass
     * @param id
     * @returns entity
     */
    this.getReference = function(entityClass, id) {
        var reference;

        reference = getFromObjectMap(entityClass, id);
        if (null === reference) {
            reference = this.createProxy(entityClass, id);
        }

        return reference;
    }

    /**
     * Create a new Proxy for the specified entity class and ID
     *
     * @param entityClass
     * @param id
     * @returns Proxy
     */
    this.createProxy = function(entityClass, id) {
        var proxy = this.proxyFactory.createProxy(entityClass, id);
        addToObjectMap(entityClass, proxy);
        return proxy;
    }
}

/**
 * Combine the entity class and it's schema and assign the $name property
 */
Object.defineProperty(ObjectManager, 'prepareEntity', {
    value: function(identifier, className, schemaClassName) {
        Object.defineProperty(className.prototype, '$name', {
            value: identifier
        });
        Object.defineProperty(className.prototype, '$schema', {
            value: new schemaClassName
        });
    }
});
