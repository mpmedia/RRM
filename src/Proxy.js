"use strict";

var ProxyFactory = function() {

    var proxyClasses = {};

    /**
     * Create a proxy class for the given entity class. All the properties of entityClass will be added and the Proxy
     * class will still answer true to instanceof calls for entityClass.
     *
     * @param entityClass
     * @return Proxy
     */
    var createProxyClass = function(entityClass) {
        var Proxy = function(id) {
            this.object = undefined;

            var self = this;

            this.load = function() {
                if (this.object === undefined) {
                    throw Error('Entity cannot be loaded');
                }
            }

            this.addProperty = function(name) {
                Object.defineProperty(this, name, {
                    get: function() {
                        self.load();
                        return self.object[name];
                    },
                    set: function(value) {
                        self.load();
                        self.object[name] = value;
                    },
                    enumerable: true
                })
            }

            for (var i in entityClass.prototype.$schema) {
                if (i == 'id') {
                    continue;
                }

                this.addProperty(i);
            }

            Object.defineProperty(this, 'id', {
                get: function() {
                    return id;
                },
                enumerable: true
            });

            entityClass.call(this);
        };

        Proxy.prototype = Object.create(entityClass.prototype);
        Proxy.constructor = Proxy;

        return Proxy;
    }

    this.getProxyClass = function(entityClass) {
        if (!((entityClass.$name + 'Proxy') in proxyClasses)) {
            proxyClasses[entityClass.$name + 'Proxy'] = createProxyClass(entityClass);
        }
        return proxyClasses[entityClass.$name + 'Proxy'];
    }

    this.createProxy = function(entityClass, id) {
        var proxyClass = this.getProxyClass(entityClass);
        return new proxyClass(id);
    }
}
