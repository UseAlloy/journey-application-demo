const { faker } = require('@faker-js/faker');

// Create the fakerUtils object
const fakerUtils = {
    generateSampleData: () => {
        const start = new Date('1950-01-01');
        const end = new Date('2000-12-31');
        const birthDate = faker.date.between({ from: start, to: end });

        return {
            firstName: faker.person.firstName(),
            lastName: faker.person.lastName(),
            email: faker.internet.email(),
            phone: faker.string.numeric(10),
            ssn: faker.string.numeric(9),
            birthDate: birthDate.toISOString().split('T')[0],
            ipAddress: faker.internet.ipv4(),
            streetAddress: faker.location.streetAddress(),
            city: faker.location.city(),
            state: faker.location.state({ abbreviated: true }),
            zipCode: faker.location.zipCode('#####')
        };
    }
};

// Export for browserify
if (typeof window !== 'undefined') {
    window.fakerUtils = fakerUtils;
} else {
    module.exports = fakerUtils;
} 