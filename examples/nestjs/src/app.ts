import "reflect-metadata";
import { Controller, Get, Injectable, Module, NotFoundException, Param } from "@nestjs/common";
import { Err, None, Ok, Some, type Option, type Result } from "@typers/core";

export interface User {
  readonly id: string;
  readonly name: string;
}

export interface UserNotFound {
  readonly kind: "UserNotFound";
  readonly id: string;
}

@Injectable()
export class UserRepository {
  private readonly users = new Map<string, User>([["1", { id: "1", name: "Ada" }]]);

  findById(id: string): Option<User> {
    const user = this.users.get(id);
    return user === undefined ? None : Some(user);
  }
}

@Injectable()
export class UsersService {
  constructor(private readonly repository: UserRepository) {}

  findById(id: string): Result<User, UserNotFound> {
    const user = this.repository.findById(id);
    return user.kind === "some" ? Ok(user.value) : Err({ kind: "UserNotFound", id });
  }
}

@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get(":id")
  getUser(@Param("id") id: string): User {
    const result = this.users.findById(id);
    if (result.kind === "err") {
      throw new NotFoundException(result.error);
    }
    return result.value;
  }
}

@Module({ controllers: [UsersController], providers: [UserRepository, UsersService] })
export class AppModule {}
