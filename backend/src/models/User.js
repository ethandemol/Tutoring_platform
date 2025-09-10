import { DataTypes, Model } from 'sequelize';
import bcrypt from 'bcryptjs';
import { sequelize } from '../config/database.js';

class User extends Model {
  // Instance method to check password
  async comparePassword(candidatePassword) {
    try {
      return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
      throw new Error('Password comparison failed');
    }
  }

  // Instance method to get public profile (without sensitive data)
  getPublicProfile() {
    const userObject = this.toJSON();
    delete userObject.password;
    delete userObject.emailVerificationToken;
    delete userObject.emailVerificationExpires;
    delete userObject.passwordResetToken;
    delete userObject.passwordResetExpires;
    return userObject;
  }

  // Static method to find user by email
  static async findByEmail(email) {
    return await this.findOne({ where: { email: email.toLowerCase() } });
  }

  // Static method to check if email exists
  static async emailExists(email) {
    const user = await this.findOne({ where: { email: email.toLowerCase() } });
    return !!user;
  }
}

User.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      len: [2, 50],
      is: /^[a-zA-Z\s]+$/
    }
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    },
    set(value) {
      this.setDataValue('email', value.toLowerCase());
    }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      len: [6, 255]
    }
  },
  avatar: {
    type: DataTypes.STRING(500),
    allowNull: true,
    validate: {
      isUrl: true
    }
  },
  role: {
    type: DataTypes.ENUM('user', 'admin'),
    defaultValue: 'user'
  },
  isEmailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  emailVerificationToken: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  emailVerificationExpires: {
    type: DataTypes.DATE,
    allowNull: true
  },
  passwordResetToken: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  passwordResetExpires: {
    type: DataTypes.DATE,
    allowNull: true
  },
  lastLogin: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  preferences: {
    type: DataTypes.JSONB,
    defaultValue: {
      theme: 'system',
      notifications: {
        email: true,
        push: true
      }
    }
  }
}, {
  sequelize,
  modelName: 'User',
  tableName: 'users',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  indexes: [
    {
      fields: ['email']
    },
    {
      fields: ['createdAt']
    }
  ],
  hooks: {
    // Hash password before saving
    beforeSave: async (user) => {
      if (user.changed('password')) {
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        user.password = await bcrypt.hash(user.password, saltRounds);
      }
    }
  }
});

export default User; 